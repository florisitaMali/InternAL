package com.internaal.service;

import com.internaal.dto.ApplicationRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.StudentBrief;
import com.internaal.entity.Role;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@Service
public class ApplicationService {

    private static final Logger log = LoggerFactory.getLogger(ApplicationService.class);

    private static final String PROFESSIONAL_PRACTICE_TYPE = "PROFESSIONAL_PRACTICE";
    private static final String INDIVIDUAL_GROWTH_TYPE = "INDIVIDUAL_GROWTH";

    private final ApplicationRepository applicationRepository;
    private final NotificationRepository notificationRepository;

    public ApplicationService(
            ApplicationRepository applicationRepository,
            NotificationRepository notificationRepository) {
        this.applicationRepository = applicationRepository;
        this.notificationRepository = notificationRepository;
    }

    public ApplicationResponse submitApplication(Integer studentId, ApplicationRequest request) {
        if (request != null && PROFESSIONAL_PRACTICE_TYPE.equals(normalizeApplicationType(request.getApplicationType()))
                && !applicationRepository.canStudentApplyForPP(studentId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Your university is deactivated; Professional Practice applications are paused. Individual Growth is still available.");
        }
        ApplicationResponse result = applicationRepository.save(studentId, request)
                .orElseThrow(() -> new RuntimeException("Failed to submit application"));
        try {
            notifyAfterSubmission(studentId, result);
        } catch (Exception e) {
            log.warn("Could not create application notification: {}", e.getMessage());
        }
        return result;
    }

    /**
     * Professional practice → PPA ({@code recipient_id} = student's {@code university_id}, matching
     * {@code useraccount.linked_entity_id} for PPA accounts).
     * Individual growth → company that owns the listing ({@code recipient_id} = {@code company_id},
     * matching {@code useraccount.linked_entity_id} for company accounts).
     */
    private void notifyAfterSubmission(Integer studentId, ApplicationResponse application) {
        String normalized = normalizeApplicationType(application.getApplicationType());
        if (PROFESSIONAL_PRACTICE_TYPE.equals(normalized)) {
            notifyPpaProfessionalPractice(studentId, application);
        } else if (INDIVIDUAL_GROWTH_TYPE.equals(normalized)) {
            notifyCompanyIndividualGrowth(studentId, application);
        }
    }

    private static String normalizeApplicationType(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        return raw.trim().toUpperCase().replace(' ', '_');
    }

    private void notifyPpaProfessionalPractice(Integer studentId, ApplicationResponse application) {
        Optional<StudentBrief> briefOpt = applicationRepository.findStudentBrief(studentId);
        if (briefOpt.isEmpty()) {
            log.warn("PPA notification skipped: no student row for student_id={}", studentId);
            return;
        }
        StudentBrief brief = briefOpt.get();
        if (brief.universityId() == null) {
            log.warn("PPA notification skipped: student {} has no university_id", studentId);
            return;
        }

        String studentName = resolveStudentName(studentId, brief, application);
        String oppTitle = resolveOpportunityTitle(application);

        String message = studentName + " submitted a professional practice application for \"" + oppTitle + "\".";

        boolean ok = notificationRepository.insertNotification(
                Role.PPA,
                brief.universityId(),
                message,
                Role.STUDENT,
                studentId
        );
        if (!ok) {
            log.warn("PPA notification insert returned false for student_id={}", studentId);
        }
    }

    private void notifyCompanyIndividualGrowth(Integer studentId, ApplicationResponse application) {
        Integer companyId = application.getCompanyId();
        if (companyId == null) {
            log.warn("Company notification skipped: application has no company_id");
            return;
        }

        Optional<StudentBrief> briefOpt = applicationRepository.findStudentBrief(studentId);
        String studentName = briefOpt.map(this::nameFromBrief).filter(s -> !s.isBlank())
                .orElseGet(() -> fallbackStudentName(application));

        String oppTitle = resolveOpportunityTitle(application);

        String message = studentName + " submitted an individual growth application for \"" + oppTitle + "\".";

        boolean ok = notificationRepository.insertNotification(
                Role.COMPANY,
                companyId,
                message,
                Role.STUDENT,
                studentId
        );
        if (!ok) {
            log.warn("Company notification insert returned false for student_id={}, company_id={}", studentId, companyId);
        }
    }

    private String resolveStudentName(Integer studentId, StudentBrief brief, ApplicationResponse application) {
        String fromBrief = nameFromBrief(brief);
        if (fromBrief != null && !fromBrief.isBlank()) {
            return fromBrief;
        }
        return fallbackStudentName(application);
    }

    private String nameFromBrief(StudentBrief brief) {
        String n = brief.fullName();
        return n == null ? "" : n.trim();
    }

    private String fallbackStudentName(ApplicationResponse application) {
        String n = application.getStudentName();
        if (n != null && !n.isBlank()) {
            return n.trim();
        }
        return "A student";
    }

    private static String resolveOpportunityTitle(ApplicationResponse application) {
        String t = application.getOpportunityTitle();
        if (t == null || t.isBlank()) {
            return "an opportunity";
        }
        return t.trim();
    }

    public List<ApplicationResponse> getApplicationsByStudent(Integer studentId) {
        return applicationRepository.findByStudentId(studentId);
    }
}
