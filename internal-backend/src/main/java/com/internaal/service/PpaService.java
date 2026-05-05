package com.internaal.service;

import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.ApplicationDecisionRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.NotificationRepository;
import com.internaal.repository.PpaRepository;
import com.internaal.repository.UniversityAdminRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PpaService {

    private static final Logger log = LoggerFactory.getLogger(PpaService.class);

    private final ApplicationRepository applicationRepository;
    private final UniversityAdminRepository universityAdminRepository;
    private final PpaRepository ppaRepository;
    private final NotificationRepository notificationRepository;

    public PpaService(ApplicationRepository applicationRepository,
                      UniversityAdminRepository universityAdminRepository,
                      PpaRepository ppaRepository,
                      NotificationRepository notificationRepository) {
        this.applicationRepository = applicationRepository;
        this.universityAdminRepository = universityAdminRepository;
        this.ppaRepository = ppaRepository;
        this.notificationRepository = notificationRepository;
    }

    public AdminPpaResponse getMyProfile(UserAccount user) {
        if (user == null || user.getRole() != Role.PPA) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "PPA role required");
        }
        int ppaId;
        try {
            ppaId = Integer.parseInt(user.getLinkedEntityId());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid PPA account link");
        }
        universityAdminRepository.tryLinkSupabaseUserToAccount(user.getUserId(), user.getSupabaseUserId());
        return universityAdminRepository.getPpaProfile(ppaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "PPA profile not found"));
    }

    public List<ApplicationResponse> listApplications(UserAccount user) {
        int universityId = requireUniversityScope(user);
        return applicationRepository.findPpaQueueByUniversityId(universityId);
    }

    public List<AdminStudentResponse> listStudents(UserAccount user) {
        int universityId = requireUniversityScope(user);
        return universityAdminRepository.listStudentsByUniversityId(universityId);
    }

    public List<AdminStudentResponse> listStudentsByField(UserAccount user) {
        int ppaId;
        try {
            ppaId = Integer.parseInt(user.getLinkedEntityId());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "linked_entity_id must be a numeric ppa_id for this endpoint");
        }

        List<Integer> fieldIds = ppaRepository.getPpaFieldIds(ppaId);
        if (fieldIds.isEmpty()) {
            return List.of();
        }

        List<AdminStudentResponse> students = ppaRepository.listStudentsByFieldIds(fieldIds);
        if (students.isEmpty()) {
            return students;
        }

        List<Integer> studentIds = students.stream()
                .map(AdminStudentResponse::studentId)
                .collect(Collectors.toList());

        Map<Integer, int[]> stats = ppaRepository.getApplicationStatsByStudentIds(studentIds);

        return students.stream().map(s -> {
            int[] stat = stats.get(s.studentId());
            int count = stat != null ? stat[0] : 0;
            String status = stat != null ? PpaRepository.statusLabel(stat[1]) : "WAITING";
            return new AdminStudentResponse(
                    s.studentId(),
                    s.fullName(),
                    s.email(),
                    s.universityName(),
                    s.departmentId(),
                    s.studyFieldId(),
                    s.studyYear(),
                    s.cgpa(),
                    s.studyFieldName(),
                    count,
                    status
            );
        }).collect(Collectors.toList());
    }

    /**
     * Resolves the university scope for PP queues: university admins use {@code linked_entity_id} as
     * {@code university_id}; PPAs use {@code linked_entity_id} as {@code ppa_id} and derive university from the
     * PPA's department.
     */
    private int requireUniversityScope(UserAccount user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() == Role.UNIVERSITY_ADMIN) {
            try {
                return Integer.parseInt(user.getLinkedEntityId());
            } catch (Exception e) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "linked_entity_id must be a numeric university_id for university admin");
            }
        }
        if (user.getRole() == Role.PPA) {
            int ppaId;
            try {
                ppaId = Integer.parseInt(user.getLinkedEntityId());
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "linked_entity_id must be a numeric ppa_id for PPA");
            }
            int deptId = universityAdminRepository.findDepartmentIdForPpa(ppaId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "PPA has no department"));
            return universityAdminRepository.findUniversityIdForDepartment(deptId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Could not resolve university for PPA"));
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "PPA or university admin role required");
    }

    /**
     * Persists PP approval/rejection and notifies the student (with optional {@code application_id} on the notification).
     */
    public ApplicationResponse updateApplicationDecision(UserAccount user, int applicationId, ApplicationDecisionRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        int universityId = requireUniversityScope(user);
        ApplicationResponse updated = applicationRepository
                .patchApprovalByPpa(applicationId, universityId, body.approved())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Application not found or not in your university PP queue"));
        notifyStudentOfPpaDecision(updated, user, body.approved());
        return updated;
    }

    private void notifyStudentOfPpaDecision(ApplicationResponse app, UserAccount actor, boolean approved) {
        Integer studentId = app.getStudentId();
        Integer applicationId = app.getApplicationId();
        if (studentId == null || applicationId == null) {
            return;
        }
        String safeTitle = applicationRepository.resolveOpportunityTitleForNotification(app);
        String message = approved
                ? "Your professional practice application for \"" + safeTitle + "\" was approved by the PP office."
                : "Your professional practice application for \"" + safeTitle + "\" was not approved.";
        int senderId;
        try {
            senderId = Integer.parseInt(actor.getLinkedEntityId());
        } catch (Exception e) {
            log.warn("notifyStudentOfPpaDecision: invalid linked_entity_id");
            return;
        }
        Role senderRole = actor.getRole();
        notificationRepository.insertNotification(
                Role.STUDENT,
                studentId,
                message,
                senderRole,
                senderId,
                applicationId);
    }
}
