package com.internaal.service;

import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.ApplicationResponse;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.PpaRepository;
import com.internaal.repository.UniversityAdminRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PpaService {

    private final ApplicationRepository applicationRepository;
    private final UniversityAdminRepository universityAdminRepository;
    private final PpaRepository ppaRepository;

    public PpaService(ApplicationRepository applicationRepository,
                      UniversityAdminRepository universityAdminRepository,
                      PpaRepository ppaRepository) {
        this.applicationRepository = applicationRepository;
        this.universityAdminRepository = universityAdminRepository;
        this.ppaRepository = ppaRepository;
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
}
