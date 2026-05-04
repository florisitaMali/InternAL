package com.internaal.service;

import com.internaal.dto.AdminCompanySummaryResponse;
import com.internaal.dto.AdminDashboardStatsResponse;
import com.internaal.dto.AdminDepartmentResponse;
import com.internaal.dto.AdminOpportunitySummaryResponse;
import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.AdminPpaCreateRequest;
import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminPpaUpdateRequest;
import com.internaal.dto.AdminStudentCreateRequest;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.AdminStudyFieldResponse;
import com.internaal.dto.ApplicationResponse;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.entity.Opportunity;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.OpportunityMapper;
import com.internaal.repository.UniversityAdminRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class UniversityAdminService {

    private final UniversityAdminRepository universityAdminRepository;
    private final ApplicationRepository applicationRepository;
    private final SupabaseAuthAdminService supabaseAuthAdminService;

    public UniversityAdminService(
            UniversityAdminRepository universityAdminRepository,
            ApplicationRepository applicationRepository,
            SupabaseAuthAdminService supabaseAuthAdminService) {
        this.universityAdminRepository = universityAdminRepository;
        this.applicationRepository = applicationRepository;
        this.supabaseAuthAdminService = supabaseAuthAdminService;
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
            AdminPpaResponse created = universityAdminRepository.insertPpa(body)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not create PPA."));
            supabaseAuthAdminService.invitePpaIfConfigured(created.email(), created.fullName());
            return created;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public AdminPpaResponse updatePpa(UserAccount user, int ppaId, AdminPpaUpdateRequest body) {
        requireAdmin(user);
        validatePpaPayload(body.fullName(), body.email(), body.departmentId(), body.studyFieldIds());
        AdminPpaResponse before = universityAdminRepository.getPpaProfile(ppaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "PPA not found."));
        if (!before.email().trim().equalsIgnoreCase(body.email().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PPA email cannot be changed.");
        }
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
            var authUserId = universityAdminRepository.findSupabaseAuthUserIdForPpa(ppaId);
            AdminPpaResponse updated = universityAdminRepository.updatePpa(ppaId, body)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "PPA not found."));
            supabaseAuthAdminService.syncPpaAuthUser(
                    before.email(),
                    updated.email(),
                    updated.fullName(),
                    authUserId);
            return updated;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public void deletePpa(UserAccount user, int ppaId) {
        requireAdmin(user);
        try {
            AdminPpaResponse existing = universityAdminRepository.getPpaProfile(ppaId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "PPA not found."));
            var authUserId = universityAdminRepository.findSupabaseAuthUserIdForPpa(ppaId);
            universityAdminRepository.deletePpa(ppaId);
            supabaseAuthAdminService.deleteAuthUserIfExists(existing.email(), authUserId);
        } catch (ResponseStatusException e) {
            throw e;
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

    public List<AdminOpportunitySummaryResponse> listOpportunitySummaries(
            UserAccount user, String status, int limit) {
        requireAdmin(user);
        parseUniversityId(user);
        List<AdminOpportunitySummaryResponse> rows = universityAdminRepository.listOpportunitySummariesForUniversityAdmin(
                status, Math.min(Math.max(limit, 1), 200));
        if (rows.isEmpty()) {
            return rows;
        }
        List<Integer> ids = rows.stream().map(AdminOpportunitySummaryResponse::opportunityId).toList();
        Map<Integer, Integer> counts = applicationRepository.countApplicationsByOpportunityIds(ids);
        return rows.stream()
                .map(r -> new AdminOpportunitySummaryResponse(
                        r.opportunityId(),
                        r.companyId(),
                        r.title(),
                        r.companyName(),
                        r.affiliatedUniversityName(),
                        r.deadline(),
                        r.type(),
                        r.targetUniversityNames(),
                        r.description(),
                        r.location(),
                        r.workMode(),
                        r.duration(),
                        r.createdAt(),
                        r.requiredSkills(),
                        counts.getOrDefault(r.opportunityId(), 0)))
                .toList();
    }

    public OpportunityResponseItem getOpportunityDetailForUniversity(UserAccount user, int opportunityId) {
        requireAdmin(user);
        parseUniversityId(user);
        Opportunity o = universityAdminRepository.findPublishedOpportunityByIdForUniversityAdmin(opportunityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found"));
        Map<Integer, Integer> counts = applicationRepository.countApplicationsByOpportunityIds(List.of(opportunityId));
        int applicantCount = counts.getOrDefault(opportunityId, 0);
        return OpportunityMapper.toResponseItem(o, 0, applicantCount);
    }

    private static int parseUniversityId(UserAccount user) {
        if (user.getLinkedEntityId() == null || user.getLinkedEntityId().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "University admin account is not linked to a university");
        }
        try {
            return Integer.parseInt(user.getLinkedEntityId().trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "linked_entity_id must be a numeric university_id");
        }
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
