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
            notifyAfterSubmission(studentId, result, request);
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
    private void notifyAfterSubmission(Integer studentId, ApplicationResponse application, ApplicationRequest originalRequest) {
        String normalized = normalizeApplicationType(application.getApplicationType());
        if (PROFESSIONAL_PRACTICE_TYPE.equals(normalized)) {
            notifyPpaProfessionalPractice(studentId, application, originalRequest);
        } else if (INDIVIDUAL_GROWTH_TYPE.equals(normalized)) {
            notifyCompanyIndividualGrowth(studentId, application, originalRequest);
        }
    }

    private static String normalizeApplicationType(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        return raw.trim().toUpperCase().replace(' ', '_');
    }

    private void notifyPpaProfessionalPractice(Integer studentId, ApplicationResponse application, ApplicationRequest originalRequest) {
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
        String oppTitle = resolveOpportunityTitleForNotificationMessage(application, originalRequest);

        String message = studentName + " submitted a professional practice application for \"" + oppTitle + "\".";

        boolean ok = notificationRepository.insertNotification(
                Role.PPA,
                brief.universityId(),
                message,
                Role.STUDENT,
                studentId,
                application.getApplicationId()
        );
        if (!ok) {
            log.warn("PPA notification insert returned false for student_id={}", studentId);
        }
    }

    private void notifyCompanyIndividualGrowth(Integer studentId, ApplicationResponse application, ApplicationRequest originalRequest) {
        Integer companyId = application.getCompanyId();
        if (companyId == null) {
            log.warn("Company notification skipped: application has no company_id");
            return;
        }

        Optional<StudentBrief> briefOpt = applicationRepository.findStudentBrief(studentId);
        String studentName = briefOpt.map(this::nameFromBrief).filter(s -> !s.isBlank())
                .orElseGet(() -> fallbackStudentName(application));

        String oppTitle = resolveOpportunityTitleForNotificationMessage(application, originalRequest);

        String message = studentName + " submitted an individual growth application for \"" + oppTitle + "\".";

        boolean ok = notificationRepository.insertNotification(
                Role.COMPANY,
                companyId,
                message,
                Role.STUDENT,
                studentId,
                application.getApplicationId()
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

    /**
     * Uses the same opportunity id the student submitted first (request), then the saved row, then repository fallbacks.
     * Ensures the notification message never relies solely on PostgREST embeds that may be missing on {@code application}.
     */
    private String resolveOpportunityTitleForNotificationMessage(ApplicationResponse application, ApplicationRequest originalRequest) {
        String embedded = application.getOpportunityTitle();
        if (embedded != null && !embedded.isBlank()) {
            return embedded.trim();
        }
        Integer oid = null;
        if (originalRequest != null && originalRequest.getOpportunityId() != null) {
            oid = originalRequest.getOpportunityId();
        }
        if (oid == null) {
            oid = application.getOpportunityId();
        }
        if (oid != null) {
            Optional<String> fromDb = applicationRepository.findOpportunityTitleById(oid);
            if (fromDb.isPresent()) {
                return fromDb.get();
            }
        }
        return applicationRepository.resolveOpportunityTitleForNotification(application);
    }

    public List<ApplicationResponse> getApplicationsByStudent(Integer studentId) {
        return applicationRepository.findByStudentId(studentId);
    }
}
