package com.internaal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.internaal.dto.AdminCompanySummaryResponse;
import com.internaal.dto.AdminDashboardStatsResponse;
import com.internaal.dto.AdminDepartmentCreateRequest;
import com.internaal.dto.AdminDepartmentResponse;
import com.internaal.dto.AdminDepartmentUpdateRequest;
import com.internaal.dto.AdminOpportunitySummaryResponse;
import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.AdminPpaCreateRequest;
import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminPpaUpdateRequest;
import com.internaal.dto.AdminStudentCreateRequest;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.AdminStudyFieldCreateRequest;
import com.internaal.dto.AdminStudyFieldResponse;
import com.internaal.dto.AdminStudyFieldUpdateRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.StudentProfileResponse;
import com.internaal.dto.UniversityProfileResponse;
import com.internaal.dto.UniversityProfileUpdateRequest;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.entity.Opportunity;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.CompanyOpportunityWriteRepository;
import com.internaal.repository.NotificationRepository;
import com.internaal.repository.OpportunityMapper;
import com.internaal.repository.StudentProfileRepository;
import com.internaal.repository.UniversityAdminRepository;
import com.internaal.repository.UniversityProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class UniversityAdminService {

    private final UniversityAdminRepository universityAdminRepository;
    private final ApplicationRepository applicationRepository;
    private final SupabaseAuthAdminService supabaseAuthAdminService;
    private final StudentProfileRepository studentProfileRepository;
    private final UniversityProfileRepository universityProfileRepository;
    private final CompanyOpportunityWriteRepository companyOpportunityWriteRepository;
    private final NotificationRepository notificationRepository;

    public UniversityAdminService(
            UniversityAdminRepository universityAdminRepository,
            ApplicationRepository applicationRepository,
            SupabaseAuthAdminService supabaseAuthAdminService,
            StudentProfileRepository studentProfileRepository,
            UniversityProfileRepository universityProfileRepository,
            CompanyOpportunityWriteRepository companyOpportunityWriteRepository,
            NotificationRepository notificationRepository) {
        this.universityAdminRepository = universityAdminRepository;
        this.applicationRepository = applicationRepository;
        this.supabaseAuthAdminService = supabaseAuthAdminService;
        this.studentProfileRepository = studentProfileRepository;
        this.universityProfileRepository = universityProfileRepository;
        this.companyOpportunityWriteRepository = companyOpportunityWriteRepository;
        this.notificationRepository = notificationRepository;
    }

    public OpportunityResponseItem setOpportunityCollaborationDecision(
            UserAccount user, int opportunityId, boolean approved) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        Opportunity existing = universityAdminRepository
                .findPublishedOpportunityForUniversity(opportunityId, universityId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Opportunity not found or not offered to your university"));
        if (existing.companyId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Opportunity has no company");
        }
        try {
            companyOpportunityWriteRepository.patchTargetCollaborationStatus(
                    opportunityId, universityId, approved ? "APPROVED" : "REJECTED");
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
        String uniLabel = universityAdminRepository.findUniversityNameById(universityId).orElse("A university");
        String listing = existing.title() != null && !existing.title().isBlank()
                ? existing.title().trim()
                : "your listing";
        String verb = approved ? "approved" : "declined";
        String msg = uniLabel + " has " + verb + " collaboration request for \"" + listing + "\".";
        notificationRepository.insertNotification(
                Role.COMPANY,
                existing.companyId(),
                msg,
                Role.UNIVERSITY_ADMIN,
                universityId,
                null,
                opportunityId);
        return getOpportunityDetailForUniversity(user, opportunityId);
    }

    public UniversityProfileResponse getUniversityProfile(UserAccount user) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        String jwt = requireJwt();
        JsonNode node = universityProfileRepository.findByUniversityIdReadable(universityId, jwt)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "University not found"));
        return mapUniversity(node, universityId);
    }

    public UniversityProfileResponse updateUniversityProfile(UserAccount user, UniversityProfileUpdateRequest req) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        String jwt = requireJwt();
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        if (req.name() != null && req.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name cannot be blank");
        }
        if (req.foundedYear() != null && (req.foundedYear() < 1800 || req.foundedYear() > 2100)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid founded year");
        }
        if (req.employeeCount() != null && req.employeeCount() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "employeeCount must be non-negative");
        }
        Map<String, Object> patch = UniversityProfileRepository.toPatchMap(
                req.name(),
                req.location(),
                req.description(),
                req.website(),
                req.email(),
                req.employeeCount(),
                req.foundedYear(),
                req.specialties(),
                req.logoUrl(),
                req.coverUrl()
        );
        JsonNode updated = universityProfileRepository.patchUniversity(universityId, jwt, patch)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Could not update university: no row was updated. Set SUPABASE_SERVICE_ROLE_KEY on the server, "
                                + "or add an RLS UPDATE policy on `university`."));
        return mapUniversity(updated, universityId);
    }

    public List<AdminDepartmentResponse> listDepartments(UserAccount user) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        return universityAdminRepository.listDepartmentsForUniversity(universityId);
    }

    public List<AdminStudyFieldResponse> listStudyFields(UserAccount user, Integer departmentId) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        return universityAdminRepository.listStudyFieldsForUniversity(universityId, departmentId);
    }

    public AdminDepartmentResponse createDepartment(UserAccount user, AdminDepartmentCreateRequest body) {
        requireAdmin(user);
        if (body == null || body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Department name is required.");
        }
        int universityId = parseUniversityId(user);
        try {
            return universityAdminRepository
                    .insertDepartment(universityId, body.name())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Could not create department. Check database constraints."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public AdminStudyFieldResponse createStudyField(UserAccount user, AdminStudyFieldCreateRequest body) {
        requireAdmin(user);
        if (body == null || body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Study field name is required.");
        }
        if (body.departmentId() == null || body.departmentId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Department is required.");
        }
        int universityId = parseUniversityId(user);
        ensureDepartmentBelongsToUniversity(body.departmentId(), universityId);
        try {
            return universityAdminRepository
                    .insertStudyField(body.departmentId(), body.name())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Could not create study field. Check database constraints."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public AdminDepartmentResponse updateDepartment(UserAccount user, int departmentId, AdminDepartmentUpdateRequest body) {
        requireAdmin(user);
        if (body == null || body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Department name is required.");
        }
        int universityId = parseUniversityId(user);
        ensureDepartmentBelongsToUniversity(departmentId, universityId);
        try {
            return universityAdminRepository
                    .updateDepartment(departmentId, body.name())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Could not update department. Check database constraints."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public void deleteDepartment(UserAccount user, int departmentId) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        ensureDepartmentBelongsToUniversity(departmentId, universityId);
        try {
            universityAdminRepository.deleteDepartment(departmentId);
        } catch (IllegalStateException e) {
            throw deleteConflictOrBadRequest(e);
        }
    }

    public AdminStudyFieldResponse updateStudyField(UserAccount user, int fieldId, AdminStudyFieldUpdateRequest body) {
        requireAdmin(user);
        if (body == null || body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Study field name is required.");
        }
        if (body.departmentId() == null || body.departmentId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Department is required.");
        }
        int universityId = parseUniversityId(user);
        int currentDept = universityAdminRepository
                .findDepartmentIdForStudyField(fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Study field not found."));
        ensureDepartmentBelongsToUniversity(currentDept, universityId);
        ensureDepartmentBelongsToUniversity(body.departmentId(), universityId);
        try {
            return universityAdminRepository
                    .updateStudyField(fieldId, body.departmentId(), body.name())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Could not update study field. Check database constraints."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public void deleteStudyField(UserAccount user, int fieldId) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        int currentDept = universityAdminRepository
                .findDepartmentIdForStudyField(fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Study field not found."));
        ensureDepartmentBelongsToUniversity(currentDept, universityId);
        try {
            universityAdminRepository.deleteStudyField(fieldId);
        } catch (IllegalStateException e) {
            throw deleteConflictOrBadRequest(e);
        }
    }

    private static ResponseStatusException deleteConflictOrBadRequest(IllegalStateException e) {
        String msg = e.getMessage();
        if (msg != null && !msg.isBlank() && msg.length() < 450) {
            return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
        }
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Could not delete this record. It may still be referenced elsewhere (e.g. students or related rows).");
    }

    public List<AdminStudentResponse> listStudents(UserAccount user) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        return universityAdminRepository.listStudentsByUniversityId(universityId);
    }

    public List<AdminPpaResponse> listPpas(UserAccount user) {
        requireAdmin(user);
        return universityAdminRepository.listPpas();
    }

    public AdminPpaResponse createPpa(UserAccount user, AdminPpaCreateRequest body) {
        requireAdmin(user);
        validatePpaPayload(body.fullName(), body.email(), body.departmentId(), body.studyFieldIds());
        ensureDepartmentBelongsToUniversity(body.departmentId(), parseUniversityId(user));
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
        ensureDepartmentBelongsToUniversity(body.departmentId(), parseUniversityId(user));
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
        ensureDepartmentBelongsToUniversity(body.departmentId(), parseUniversityId(user));
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
        int universityId = parseUniversityId(user);
        List<AdminStudentResponse> students = universityAdminRepository.listStudentsByUniversityId(universityId);
        int depts = universityAdminRepository.listDepartmentsForUniversity(universityId).size();
        int fields = universityAdminRepository.listStudyFieldsForUniversity(universityId, null).size();
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
        int universityId = parseUniversityId(user);
        List<AdminOpportunitySummaryResponse> rows = universityAdminRepository.listOpportunitySummariesForUniversityAdmin(
                universityId, status, Math.min(Math.max(limit, 1), 200));
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
                        counts.getOrDefault(r.opportunityId(), 0),
                        r.viewerCollaborationStatus()))
                .toList();
    }

    public OpportunityResponseItem getOpportunityDetailForUniversity(UserAccount user, int opportunityId) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        Opportunity o = universityAdminRepository.findPublishedOpportunityForUniversity(opportunityId, universityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found"));
        Map<Integer, Integer> counts = applicationRepository.countApplicationsByOpportunityIds(List.of(opportunityId));
        int applicantCount = counts.getOrDefault(opportunityId, 0);
        return OpportunityMapper.toResponseItem(o, 0, applicantCount);
    }

    /**
     * Read-only student profile for university admins (after verifying the student belongs to this university
     * or appears in the PP queue).
     */
    public StudentProfileResponse getStudentProfileForViewer(UserAccount user, int studentId) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        boolean allowed = universityAdminRepository.listStudentsByUniversityId(universityId).stream()
                .anyMatch(s -> s.studentId() == studentId);
        if (!allowed) {
            allowed = applicationRepository.findPpaQueueByUniversityId(universityId).stream()
                    .anyMatch(a -> a.getStudentId() != null && a.getStudentId() == studentId);
        }
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this student profile");
        }
        StudentProfileResponse profile = studentProfileRepository.findByStudentIdAsService(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student profile not found"));
        StudentProfileViewerUrls.rewriteDownloadUrls(profile, studentId, "admin");
        return profile;
    }

    private static UniversityProfileResponse mapUniversity(JsonNode n, int fallbackUniversityId) {
        int id = fallbackUniversityId;
        if (n != null) {
            if (n.hasNonNull("university_id")) {
                id = n.get("university_id").asInt();
            } else if (n.hasNonNull("id")) {
                id = n.get("id").asInt();
            }
        }
        Integer founded = intOrNull(n, "founded");
        if (founded == null) {
            founded = intOrNull(n, "founded_year");
        }
        Integer employees = intOrNull(n, "number_of_employees");
        if (employees == null) {
            employees = intOrNull(n, "employee_count");
        }
        return new UniversityProfileResponse(
                id,
                text(n, "name"),
                text(n, "location"),
                text(n, "description"),
                text(n, "website"),
                text(n, "email"),
                employees,
                founded,
                text(n, "specialties"),
                firstText(n, "logo_url", "profile_photo", "logo"),
                firstText(n, "cover_url", "cover")
        );
    }

    /** First non-blank among JSON fields (PostgREST returns snake_case column names). */
    private static String firstText(JsonNode n, String... fields) {
        if (n == null || fields == null) {
            return null;
        }
        for (String f : fields) {
            String t = text(n, f);
            if (t != null) {
                return t;
            }
        }
        return null;
    }

    private static String text(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        String s = n.get(field).asText();
        return s != null && s.isBlank() ? null : s;
    }

    private static Integer intOrNull(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        JsonNode v = n.get(field);
        if (v.isNumber()) {
            return v.isIntegralNumber() ? v.intValue() : (int) Math.round(v.doubleValue());
        }
        if (!v.isTextual()) {
            return null;
        }
        String t = v.asText().trim();
        if (t.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(t);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String requireJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getCredentials() instanceof String jwt) || jwt.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing token");
        }
        return jwt;
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

    private void ensureDepartmentBelongsToUniversity(int departmentId, int universityId) {
        var owner = universityAdminRepository.findUniversityIdForDepartment(departmentId);
        if (owner.isEmpty() || !owner.get().equals(universityId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Department does not belong to your university.");
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
