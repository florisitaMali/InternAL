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
import com.internaal.dto.PpaCsvImportResult;
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
import com.internaal.repository.NotificationRepository;
import com.internaal.repository.OpportunityMapper;
import com.internaal.repository.PpaRepository;
import com.internaal.repository.StudentProfileRepository;
import com.internaal.repository.UniversityAdminRepository;
import com.internaal.repository.UniversityProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.web.client.HttpClientErrorException;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.web.multipart.MultipartFile;

@Service
public class UniversityAdminService {

    private final UniversityAdminRepository universityAdminRepository;
    private final ApplicationRepository applicationRepository;
    private final SupabaseAuthAdminService supabaseAuthAdminService;
    private final StudentProfileRepository studentProfileRepository;
    private final UniversityProfileRepository universityProfileRepository;
    private final NotificationRepository notificationRepository;
    private final PpaRepository ppaRepository;

    public UniversityAdminService(
            UniversityAdminRepository universityAdminRepository,
            ApplicationRepository applicationRepository,
            SupabaseAuthAdminService supabaseAuthAdminService,
            StudentProfileRepository studentProfileRepository,
            UniversityProfileRepository universityProfileRepository,
            NotificationRepository notificationRepository,
            PpaRepository ppaRepository) {
        this.universityAdminRepository = universityAdminRepository;
        this.applicationRepository = applicationRepository;
        this.supabaseAuthAdminService = supabaseAuthAdminService;
        this.studentProfileRepository = studentProfileRepository;
        this.universityProfileRepository = universityProfileRepository;
        this.notificationRepository = notificationRepository;
        this.ppaRepository = ppaRepository;
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
                null,
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
        List<AdminStudentResponse> rows = universityAdminRepository.listStudentsByUniversityId(universityId);
        return enrichStudentApplicationStats(rows);
    }

    /** Same application aggregates as PPA “My students” (waiting / pending / approved / rejected). */
    private List<AdminStudentResponse> enrichStudentApplicationStats(List<AdminStudentResponse> students) {
        if (students.isEmpty()) {
            return students;
        }
        List<Integer> studentIds = students.stream().map(AdminStudentResponse::studentId).toList();
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
                    s.departmentName(),
                    count,
                    status
            );
        }).toList();
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

    public PpaCsvImportResult importPpaFile(UserAccount user, MultipartFile file,
                                              String nameCol, String emailCol,
                                              String deptCol, String fieldCol) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);

        String filename = file.getOriginalFilename();
        boolean isExcel = filename != null &&
                (filename.toLowerCase().endsWith(".xlsx") || filename.toLowerCase().endsWith(".xls"));

        List<Map<String, String>> rows;
        if (isExcel) {
            rows = parseExcelRows(file);
        } else {
            rows = parseCsvRows(file);
        }

        List<AdminDepartmentResponse> allDepts = universityAdminRepository.listDepartmentsForUniversity(universityId);
        List<AdminStudyFieldResponse> allFields = universityAdminRepository.listStudyFieldsForUniversity(universityId, null);

        Map<String, Integer> deptNameToId = new LinkedHashMap<>();
        for (AdminDepartmentResponse d : allDepts) {
            deptNameToId.put(d.name().trim().toLowerCase(), d.departmentId());
        }
        Map<String, AdminStudyFieldResponse> fieldNameToObj = new LinkedHashMap<>();
        for (AdminStudyFieldResponse f : allFields) {
            fieldNameToObj.put(f.name().trim().toLowerCase(), f);
        }

        String nameKey = nameCol.trim().toLowerCase();
        String emailKey = emailCol.trim().toLowerCase();
        String deptKey = deptCol.trim().toLowerCase();
        String fieldKey = fieldCol.trim().toLowerCase();

        int created = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            int rowNum = i + 2;
            Map<String, String> row = rows.get(i);
            try {
                String fullName = row.getOrDefault(nameKey, "").trim();
                String email = row.getOrDefault(emailKey, "").trim();
                String deptName = row.getOrDefault(deptKey, "").trim();
                String fieldName = row.getOrDefault(fieldKey, "").trim();

                if (fullName.isBlank()) {
                    errors.add("Row " + rowNum + ": Name is empty.");
                    failed++;
                    continue;
                }
                if (email.isBlank()) {
                    errors.add("Row " + rowNum + ": Email is empty.");
                    failed++;
                    continue;
                }
                if (deptName.isBlank()) {
                    errors.add("Row " + rowNum + ": Department is empty.");
                    failed++;
                    continue;
                }
                Integer departmentId = deptNameToId.get(deptName.toLowerCase());
                if (departmentId == null) {
                    errors.add("Row " + rowNum + ": Department \"" + deptName + "\" not found.");
                    failed++;
                    continue;
                }
                if (fieldName.isBlank()) {
                    errors.add("Row " + rowNum + ": Study Field is empty.");
                    failed++;
                    continue;
                }

                List<Integer> studyFieldIds = new ArrayList<>();
                for (String part : fieldName.split("[;,]")) {
                    String sfName = part.trim();
                    if (sfName.isEmpty()) continue;
                    AdminStudyFieldResponse sf = fieldNameToObj.get(sfName.toLowerCase());
                    if (sf == null) {
                        errors.add("Row " + rowNum + ": Study field \"" + sfName + "\" not found.");
                        failed++;
                        continue;
                    }
                    if (sf.departmentId() != departmentId.intValue()) {
                        errors.add("Row " + rowNum + ": Study field \"" + sfName + "\" does not belong to department \"" + deptName + "\".");
                        failed++;
                        continue;
                    }
                    studyFieldIds.add(sf.fieldId());
                }
                if (studyFieldIds.isEmpty()) continue;

                AdminPpaCreateRequest createReq = new AdminPpaCreateRequest(
                        fullName, email.toLowerCase(), departmentId, studyFieldIds);
                try {
                    createPpa(user, createReq);
                    created++;
                } catch (ResponseStatusException e) {
                    errors.add("Row " + rowNum + ": " + e.getReason());
                    failed++;
                }
            } catch (Exception e) {
                errors.add("Row " + rowNum + ": " + e.getMessage());
                failed++;
            }
        }

        return new PpaCsvImportResult(created, 0, failed, errors);
    }

    private static List<Map<String, String>> parseCsvRows(MultipartFile file) {
        try (Reader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT
                     .builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setIgnoreHeaderCase(true)
                     .setTrim(true)
                     .build()
                     .parse(reader)) {
            List<Map<String, String>> result = new ArrayList<>();
            for (CSVRecord record : parser.getRecords()) {
                Map<String, String> row = new LinkedHashMap<>();
                record.toMap().forEach((k, v) -> row.put(k.trim().toLowerCase(), v != null ? v.trim() : ""));
                result.add(row);
            }
            return result;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Could not parse CSV file: " + e.getMessage());
        }
    }

    private static List<Map<String, String>> parseExcelRows(MultipartFile file) {
        try (InputStream is = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getPhysicalNumberOfRows() < 2) {
                return List.of();
            }
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return List.of();
            }
            List<String> headers = new ArrayList<>();
            for (int c = 0; c < headerRow.getLastCellNum(); c++) {
                Cell cell = headerRow.getCell(c);
                headers.add(cell != null ? cellToString(cell).trim().toLowerCase() : "");
            }

            List<Map<String, String>> result = new ArrayList<>();
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                boolean allBlank = true;
                Map<String, String> rowMap = new LinkedHashMap<>();
                for (int c = 0; c < headers.size(); c++) {
                    Cell cell = row.getCell(c);
                    String value = cell != null ? cellToString(cell).trim() : "";
                    if (!value.isEmpty()) allBlank = false;
                    rowMap.put(headers.get(c), value);
                }
                if (!allBlank) result.add(rowMap);
            }
            return result;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Could not parse Excel file: " + e.getMessage());
        }
    }

    private static String cellToString(Cell cell) {
        if (cell == null) return "";
        if (cell.getCellType() == CellType.NUMERIC) {
            double d = cell.getNumericCellValue();
            if (d == Math.floor(d) && !Double.isInfinite(d)) {
                return String.valueOf((long) d);
            }
            return String.valueOf(d);
        }
        if (cell.getCellType() == CellType.BOOLEAN) {
            return String.valueOf(cell.getBooleanCellValue());
        }
        if (cell.getCellType() == CellType.FORMULA) {
            try {
                return cell.getStringCellValue();
            } catch (Exception e) {
                try {
                    double d = cell.getNumericCellValue();
                    if (d == Math.floor(d) && !Double.isInfinite(d)) return String.valueOf((long) d);
                    return String.valueOf(d);
                } catch (Exception e2) {
                    return "";
                }
            }
        }
        return cell.getStringCellValue() != null ? cell.getStringCellValue() : "";
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
     * University admin accepts or declines collaboration for their university on a targeted opportunity.
     */
    public OpportunityResponseItem decideCollaboration(UserAccount user, int opportunityId, boolean approved) {
        requireAdmin(user);
        int universityId = parseUniversityId(user);
        Opportunity scope = universityAdminRepository.findPublishedOpportunityForUniversity(opportunityId, universityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found"));
        String current = universityAdminRepository.getCollaborationStatus(opportunityId, universityId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Your university is not listed as a collaboration target for this opportunity"));
        String norm = OpportunityMapper.normalizeCollaborationStatus(current);
        if (!"PENDING".equals(norm)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Collaboration has already been decided");
        }
        String newStatus = approved ? "APPROVED" : "REJECTED";
        try {
            universityAdminRepository.patchCollaborationStatus(opportunityId, universityId, newStatus);
        } catch (HttpClientErrorException e) {
            String hint = e.getResponseBodyAsString();
            if (hint != null && hint.length() > 200) {
                hint = hint.substring(0, 200);
            }
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Could not save collaboration decision. If this persists, ensure the database allows "
                            + "collaboration_status REJECTED for opportunitytarget. " + (hint != null ? hint : ""));
        }
        Integer companyId = scope.companyId();
        if (companyId != null) {
            String uniLabel = universityAdminRepository.findUniversityNameById(universityId).orElse("A university");
            String title = scope.title() != null && !scope.title().isBlank() ? scope.title().trim() : "An opportunity";
            String action = approved ? "approved" : "declined";
            String msg = uniLabel + " has " + action + " collaboration on \"" + title + "\".";
            notificationRepository.insertNotification(
                    Role.COMPANY,
                    companyId,
                    msg,
                    Role.UNIVERSITY_ADMIN,
                    universityId,
                    null,
                    opportunityId);
        }
        return getOpportunityDetailForUniversity(user, opportunityId);
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
