package com.internaal.service;

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

    public List<ApplicationResponse> listApplications(UserAccount user) {
        int universityId = requireUniversityScope(user);
        return applicationRepository.findPpaQueueByUniversityId(universityId);
    }

    public List<AdminStudentResponse> listStudents(UserAccount user) {
        int universityId = requireUniversityScope(user);
        return universityAdminRepository.listStudentsByUniversityId(universityId);
    }

    /**
     * Uses {@code linked_entity_id} as {@code university_id} for {@link Role#PPA} (and university admins calling
     * PPA endpoints). Align this value in Supabase {@code useraccount} with your schema.
     */
    private static int requireUniversityScope(UserAccount user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != Role.PPA && user.getRole() != Role.UNIVERSITY_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "PPA or university admin role required");
        }
        try {
            return Integer.parseInt(user.getLinkedEntityId());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "linked_entity_id must be a numeric university_id for this endpoint");
        }
    }
}
