package com.internaal.service;

import com.internaal.dto.AdminCompanySummaryResponse;
import com.internaal.dto.AdminDashboardStatsResponse;
import com.internaal.dto.AdminDepartmentResponse;
import com.internaal.dto.AdminOpportunitySummaryResponse;
import com.internaal.dto.AdminPpaCreateRequest;
import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminPpaUpdateRequest;
import com.internaal.dto.AdminStudentCreateRequest;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.AdminStudyFieldResponse;
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
public class UniversityAdminService {

    private final UniversityAdminRepository universityAdminRepository;
    private final ApplicationRepository applicationRepository;

    public UniversityAdminService(
            UniversityAdminRepository universityAdminRepository,
            ApplicationRepository applicationRepository) {
        this.universityAdminRepository = universityAdminRepository;
        this.applicationRepository = applicationRepository;
    }

    public List<AdminDepartmentResponse> listDepartments(UserAccount user) {
        requireAdmin(user);
        return universityAdminRepository.listDepartments();
    }

    public List<AdminStudyFieldResponse> listStudyFields(UserAccount user, Integer departmentId) {
        requireAdmin(user);
        return universityAdminRepository.listStudyFields(departmentId);
    }

    public List<AdminStudentResponse> listStudents(UserAccount user) {
        requireAdmin(user);
        return universityAdminRepository.listStudents();
    }

    public List<AdminPpaResponse> listPpas(UserAccount user) {
        requireAdmin(user);
        return universityAdminRepository.listPpas();
    }

    public AdminPpaResponse createPpa(UserAccount user, AdminPpaCreateRequest body) {
        requireAdmin(user);
        validatePpaPayload(body.fullName(), body.email(), body.departmentId(), body.studyFieldIds());
        if (universityAdminRepository.findPpaIdByEmail(body.email()).isPresent()
                || universityAdminRepository.userAccountEmailBelongsToDifferentPpa(body.email(), null)
                || universityAdminRepository.emailExistsInUserAccount(body.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists.");
        }
        if (!universityAdminRepository.studyFieldsBelongToDepartment(body.departmentId(), body.studyFieldIds())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned study fields must belong to selected department.");
        }
        try {
            return universityAdminRepository.insertPpa(body)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not create PPA."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public AdminPpaResponse updatePpa(UserAccount user, int ppaId, AdminPpaUpdateRequest body) {
        requireAdmin(user);
        validatePpaPayload(body.fullName(), body.email(), body.departmentId(), body.studyFieldIds());
        var ppaWithSameEmail = universityAdminRepository.findPpaIdByEmail(body.email());
        if (ppaWithSameEmail.isPresent() && ppaWithSameEmail.get() != ppaId) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists.");
        }
        if (universityAdminRepository.userAccountEmailBelongsToDifferentPpa(body.email(), ppaId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists.");
        }
        if (!universityAdminRepository.studyFieldsBelongToDepartment(body.departmentId(), body.studyFieldIds())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned study fields must belong to selected department.");
        }
        try {
            return universityAdminRepository.updatePpa(ppaId, body)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "PPA not found."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public void deletePpa(UserAccount user, int ppaId) {
        requireAdmin(user);
        try {
            universityAdminRepository.deletePpa(ppaId);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public AdminStudentResponse createStudent(UserAccount user, AdminStudentCreateRequest body) {
        requireAdmin(user);
        if (body == null || body.fullName() == null || body.fullName().isBlank()
                || body.email() == null || body.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fullName and email are required");
        }
        try {
            return universityAdminRepository.insertStudent(body)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Could not create student. Check service role key and RLS on `student`."));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public AdminDashboardStatsResponse dashboardStats(UserAccount user) {
        requireAdmin(user);
        List<AdminStudentResponse> students = universityAdminRepository.listStudents();
        int depts = universityAdminRepository.listDepartments().size();
        int fields = universityAdminRepository.listStudyFields(null).size();
        int ppas = universityAdminRepository.countUsersWithRole("PPA");
        return new AdminDashboardStatsResponse(students.size(), depts, fields, ppas);
    }

    public List<AdminCompanySummaryResponse> listCompanies(UserAccount user, int limit) {
        requireAdmin(user);
        return universityAdminRepository.listCompanies(Math.min(Math.max(limit, 1), 50));
    }

    public List<AdminOpportunitySummaryResponse> listOpportunitySummaries(UserAccount user, int limit) {
        requireAdmin(user);
        return universityAdminRepository.listOpportunitySummaries(Math.min(Math.max(limit, 1), 200));
    }

    public List<ApplicationResponse> listAllApplications(UserAccount user) {
        requireAdmin(user);
        return applicationRepository.findAllApplications();
    }

    private static void requireAdmin(UserAccount user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != Role.UNIVERSITY_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "University admin role required");
        }
    }

    private static void validatePpaPayload(String fullName, String email, Integer departmentId, List<Integer> studyFieldIds) {
        if (fullName == null || fullName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fullName is required");
        }
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "email is required");
        }
        if (departmentId == null || departmentId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "departmentId is required");
        }
        if (studyFieldIds == null || studyFieldIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "studyFieldIds is required");
        }
    }
}
