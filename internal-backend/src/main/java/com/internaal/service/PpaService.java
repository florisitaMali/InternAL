package com.internaal.service;

import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.ApplicationResponse;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.UniversityAdminRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class PpaService {

    private final ApplicationRepository applicationRepository;
    private final UniversityAdminRepository universityAdminRepository;

    public PpaService(ApplicationRepository applicationRepository, UniversityAdminRepository universityAdminRepository) {
        this.applicationRepository = applicationRepository;
        this.universityAdminRepository = universityAdminRepository;
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
