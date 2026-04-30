package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.AdminCompanySummaryResponse;
import com.internaal.dto.AdminDepartmentResponse;
import com.internaal.dto.AdminOpportunitySummaryResponse;
import com.internaal.dto.AdminPpaCreateRequest;
import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminPpaUpdateRequest;
import com.internaal.dto.AdminStudentCreateRequest;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.AdminStudyFieldResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.HashSet;
import java.util.stream.Collectors;

/**
 * Read/write catalog and student rows for university admins via PostgREST (service role).
 */
@Repository
public class UniversityAdminRepository {
    private static final String PPA_TABLE = "professionalpracticeapprover";
    private static final String PPA_FIELD_TABLE = "ppa_studyfield";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;
    /** "join" = ppa_studyfield; "column" = studyfield.ppa_id (no join table). */
    private final String ppaFieldLink;
    /** Satisfies NOT NULL useraccount.password when inserting PPA rows (login is via Supabase). */
    private final String ppaUseraccountPasswordPlaceholder;

    public UniversityAdminRepository(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon.key}") String anonKey,
            @Value("${supabase.service.role.key:}") String serviceRoleKey,
            @Value("${supabase.ppa.field-link:join}") String ppaFieldLink,
            @Value("${supabase.ppa.useraccount-password-placeholder:__SUPABASE_AUTH__}") String ppaUseraccountPasswordPlaceholder) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl;
        this.anonKey = anonKey;
        this.serviceRoleKey = serviceRoleKey;
        this.ppaFieldLink = ppaFieldLink == null ? "join" : ppaFieldLink.trim().toLowerCase();
        String ph = ppaUseraccountPasswordPlaceholder == null ? "" : ppaUseraccountPasswordPlaceholder.trim();
        this.ppaUseraccountPasswordPlaceholder = ph.isEmpty() ? "__SUPABASE_AUTH__" : ph;
    }

    private boolean ppaFieldsOnStudyfieldColumn() {
        return "column".equals(ppaFieldLink) || "studyfield".equals(ppaFieldLink);
    }

    private HttpHeaders createServiceHeaders() {
        String key = (serviceRoleKey != null && !serviceRoleKey.isBlank()) ? serviceRoleKey : anonKey;
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private Optional<JsonNode> fetchArray(String url) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(createServiceHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return Optional.of(objectMapper.readTree(response.getBody()));
            }
        } catch (Exception ignored) {
            /* empty */
        }
        return Optional.empty();
    }

    private Integer intVal(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        JsonNode v = n.get(field);
        return v.isNumber() ? v.asInt() : null;
    }

    private String text(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        return n.get(field).asText();
    }

    public List<AdminDepartmentResponse> listDepartments() {
        String url = supabaseUrl + "/rest/v1/department?select=department_id,name,university(name)&order=name";
        List<AdminDepartmentResponse> out = new ArrayList<>();
        fetchArray(url).ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    String uni = null;
                    JsonNode u = n.get("university");
                    if (u != null && !u.isNull()) {
                        uni = text(u, "name");
                    }
                    Integer id = intVal(n, "department_id");
                    if (id != null) {
                        out.add(new AdminDepartmentResponse(id, text(n, "name"), uni));
                    }
                }
            }
        });
        return out;
    }

    public List<AdminStudyFieldResponse> listStudyFields(Integer departmentId) {
        StringBuilder url = new StringBuilder(supabaseUrl + "/rest/v1/studyfield?select=field_id,name,department_id&order=name");
        if (departmentId != null) {
            url.append("&department_id=eq.").append(departmentId);
        }
        List<AdminStudyFieldResponse> out = new ArrayList<>();
        fetchArray(url.toString()).ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    Integer id = intVal(n, "field_id");
                    Integer dept = intVal(n, "department_id");
                    if (id != null && dept != null) {
                        out.add(new AdminStudyFieldResponse(id, text(n, "name"), dept));
                    }
                }
            }
        });
        return out;
    }

    public List<AdminStudentResponse> listStudentsByUniversityId(int universityId) {
        String url = supabaseUrl + "/rest/v1/student?university_id=eq." + universityId
                + "&select=student_id,full_name,email,university_id,department_id,field_id,study_year,cgpa,university(name)"
                + "&order=full_name&limit=2000";
        return fetchStudentRows(url);
    }

    public List<AdminStudentResponse> listStudents() {
        String url = supabaseUrl + "/rest/v1/student?select=student_id,full_name,email,university_id,department_id,field_id,study_year,cgpa"
                + ",university(name)&order=full_name&limit=2000";
        return fetchStudentRows(url);
    }

    private List<AdminStudentResponse> fetchStudentRows(String url) {
        List<AdminStudentResponse> out = new ArrayList<>();
        fetchArray(url).ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    Integer sid = intVal(n, "student_id");
                    if (sid == null) {
                        continue;
                    }
                    String uniName = null;
                    JsonNode u = n.get("university");
                    if (u != null && !u.isNull()) {
                        uniName = text(u, "name");
                    }
                    BigDecimal cgpa = null;
                    if (n.has("cgpa") && !n.get("cgpa").isNull()) {
                        cgpa = n.get("cgpa").decimalValue();
                    }
                    out.add(new AdminStudentResponse(
                            sid,
                            text(n, "full_name"),
                            text(n, "email"),
                            uniName,
                            intVal(n, "department_id"),
                            intVal(n, "field_id"),
                            intVal(n, "study_year"),
                            cgpa,
                            null,
                            null,
                            null
                    ));
                }
            }
        });
        return out;
    }

    public Optional<Integer> findUniversityIdForDepartment(int departmentId) {
        String url = supabaseUrl + "/rest/v1/department?department_id=eq." + departmentId + "&select=university_id&limit=1";
        return fetchArray(url).flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.ofNullable(intVal(arr.get(0), "university_id")) : Optional.empty());
    }

    public Optional<AdminStudentResponse> insertStudent(AdminStudentCreateRequest req) throws Exception {
        Optional<Integer> uniOpt = findUniversityIdForDepartment(req.departmentId());
        if (uniOpt.isEmpty()) {
            throw new IllegalArgumentException("Department not found.");
        }
        int universityId = uniOpt.get();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("full_name", req.fullName().trim());
        row.put("email", req.email().trim().toLowerCase());
        row.put("university_id", universityId);
        row.put("department_id", req.departmentId());
        row.put("field_id", req.studyFieldId());
        row.put("study_year", req.studyYear());
        if (req.cgpa() != null) {
            row.put("cgpa", req.cgpa());
        }

        String json = objectMapper.writeValueAsString(row);
        HttpHeaders headers = createServiceHeaders();
        headers.set("Prefer", "return=representation");
        HttpEntity<String> entity = new HttpEntity<>(json, headers);
        String url = supabaseUrl + "/rest/v1/student";
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null || response.getBody().isBlank()) {
            return Optional.empty();
        }
        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode first = root.isArray() && root.size() > 0 ? root.get(0) : (root.isObject() ? root : null);
        if (first == null) {
            return Optional.empty();
        }
        Integer sid = intVal(first, "student_id");
        if (sid == null) {
            return Optional.empty();
        }
        BigDecimal cgpa = first.has("cgpa") && !first.get("cgpa").isNull() ? first.get("cgpa").decimalValue() : req.cgpa();
        return Optional.of(new AdminStudentResponse(
                sid,
                text(first, "full_name"),
                text(first, "email"),
                null,
                intVal(first, "department_id"),
                intVal(first, "field_id"),
                intVal(first, "study_year"),
                cgpa,
                null,
                null,
                null
        ));
    }

    public int countUsersWithRole(String role) {
        String url = supabaseUrl + "/rest/v1/useraccount?role=eq." + role + "&select=user_id";
        return fetchArray(url).map(arr -> arr.isArray() ? arr.size() : 0).orElse(0);
    }

    public List<AdminCompanySummaryResponse> listCompanies(int limit) {
        String url = supabaseUrl + "/rest/v1/company?select=company_id,name,industry&order=name&limit=" + limit;
        List<AdminCompanySummaryResponse> out = new ArrayList<>();
        fetchArray(url).ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    Integer id = intVal(n, "company_id");
                    if (id == null && n.has("id") && !n.get("id").isNull()) {
                        id = intVal(n, "id");
                    }
                    if (id != null) {
                        out.add(new AdminCompanySummaryResponse(id, text(n, "name"), text(n, "industry")));
                    }
                }
            }
        });
        return out;
    }

    public List<AdminOpportunitySummaryResponse> listOpportunitySummaries(int limit) {
        String url = supabaseUrl + "/rest/v1/opportunity?select=opportunity_id,title,deadline,type,company(name)"
                + "&order=created_at.desc&limit=" + limit;
        List<AdminOpportunitySummaryResponse> out = new ArrayList<>();
        fetchArray(url).ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    Integer oid = intVal(n, "opportunity_id");
                    if (oid == null) {
                        continue;
                    }
                    String companyName = null;
                    JsonNode c = n.get("company");
                    if (c != null && !c.isNull()) {
                        companyName = text(c, "name");
                    }
                    String typeStr = text(n, "type");
                    String deadline = text(n, "deadline");
                    out.add(new AdminOpportunitySummaryResponse(oid, text(n, "title"), companyName, deadline, typeStr));
                }
            }
        });
        return out;
    }

    public List<AdminPpaResponse> listPpas() {
        String url = supabaseUrl + "/rest/v1/" + PPA_TABLE
                + "?select=ppa_id,full_name,email,department_id,department(name)"
                + "&order=full_name&limit=2000";
        List<AdminPpaResponse> out = new ArrayList<>();
        fetchArray(url).ifPresent(arr -> {
            if (!arr.isArray()) {
                return;
            }
            for (JsonNode n : arr) {
                Integer ppaId = intVal(n, "ppa_id");
                if (ppaId == null) {
                    continue;
                }
                Integer departmentId = intVal(n, "department_id");
                String departmentName = null;
                JsonNode d = n.get("department");
                if (d != null && !d.isNull()) {
                    departmentName = text(d, "name");
                }
                out.add(new AdminPpaResponse(
                        ppaId,
                        text(n, "full_name"),
                        text(n, "email"),
                        departmentId,
                        departmentName,
                        List.of()
                ));
            }
        });
        if (out.isEmpty()) {
            return out;
        }
        Map<Integer, List<AdminStudyFieldResponse>> ppaFields = loadPpaStudyFields(
                out.stream().map(AdminPpaResponse::ppaId).collect(Collectors.toSet()));
        List<AdminPpaResponse> mapped = new ArrayList<>();
        for (AdminPpaResponse p : out) {
            mapped.add(new AdminPpaResponse(
                    p.ppaId(),
                    p.fullName(),
                    p.email(),
                    p.departmentId(),
                    p.departmentName(),
                    ppaFields.getOrDefault(p.ppaId(), List.of())));
        }
        return mapped;
    }

    public boolean emailExistsInUserAccount(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase();
        if (normalized.isBlank()) {
            return false;
        }
        String url = supabaseUrl + "/rest/v1/useraccount?email=eq." + normalized + "&select=user_id&limit=1";
        return fetchArray(url).map(arr -> arr.isArray() && !arr.isEmpty()).orElse(false);
    }

    public Optional<Integer> findPpaIdByEmail(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase();
        if (normalized.isBlank()) {
            return Optional.empty();
        }
        String url = supabaseUrl + "/rest/v1/" + PPA_TABLE + "?email=eq." + normalized + "&select=ppa_id&limit=1";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray() || arr.get().isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(intVal(arr.get().get(0), "ppa_id"));
    }

    public boolean userAccountEmailBelongsToDifferentPpa(String email, Integer currentPpaId) {
        String normalized = email == null ? "" : email.trim().toLowerCase();
        if (normalized.isBlank()) {
            return false;
        }
        String url = supabaseUrl + "/rest/v1/useraccount?email=eq." + normalized + "&select=role,linked_entity_id&limit=1";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray() || arr.get().isEmpty()) {
            return false;
        }
        JsonNode row = arr.get().get(0);
        String role = text(row, "role");
        String linkedEntityId = text(row, "linked_entity_id");
        if ("PPA".equalsIgnoreCase(role)) {
            if (currentPpaId == null) {
                return true;
            }
            return !String.valueOf(currentPpaId).equals(linkedEntityId);
        }
        return true;
    }

    public boolean studyFieldsBelongToDepartment(Integer departmentId, List<Integer> studyFieldIds) {
        if (departmentId == null || studyFieldIds == null || studyFieldIds.isEmpty()) {
            return false;
        }
        Set<Integer> wanted = studyFieldIds.stream().filter(v -> v != null && v > 0).collect(Collectors.toSet());
        if (wanted.isEmpty()) {
            return false;
        }
        String idList = wanted.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/studyfield?department_id=eq." + departmentId
                + "&field_id=in.(" + idList + ")&select=field_id";
        Set<Integer> found = new HashSet<>();
        fetchArray(url).ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    Integer id = intVal(n, "field_id");
                    if (id != null) {
                        found.add(id);
                    }
                }
            }
        });
        return found.containsAll(wanted);
    }

    public Optional<AdminPpaResponse> insertPpa(AdminPpaCreateRequest req) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("full_name", req.fullName().trim());
        row.put("email", req.email().trim().toLowerCase());
        row.put("department_id", req.departmentId());

        String body = objectMapper.writeValueAsString(row);
        HttpHeaders headers = createServiceHeaders();
        headers.set("Prefer", "return=representation");
        ResponseEntity<String> response = restTemplate.exchange(
                supabaseUrl + "/rest/v1/" + PPA_TABLE,
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class
        );
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null || response.getBody().isBlank()) {
            return Optional.empty();
        }
        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode first = root.isArray() && !root.isEmpty() ? root.get(0) : null;
        if (first == null) {
            return Optional.empty();
        }
        Integer ppaId = intVal(first, "ppa_id");
        if (ppaId == null) {
            return Optional.empty();
        }

        replacePpaStudyFields(ppaId, req.studyFieldIds());
        upsertUserAccountForPpa(req.email(), ppaId, req.departmentId());
        return findPpaById(ppaId);
    }

    public Optional<AdminPpaResponse> updatePpa(int ppaId, AdminPpaUpdateRequest req) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("full_name", req.fullName().trim());
        row.put("email", req.email().trim().toLowerCase());
        row.put("department_id", req.departmentId());
        String body = objectMapper.writeValueAsString(row);

        HttpHeaders headers = createServiceHeaders();
        headers.set("Prefer", "return=representation");
        ResponseEntity<String> response = restTemplate.exchange(
                supabaseUrl + "/rest/v1/" + PPA_TABLE + "?ppa_id=eq." + ppaId,
                HttpMethod.PATCH,
                new HttpEntity<>(body, headers),
                String.class
        );
        if (!response.getStatusCode().is2xxSuccessful()) {
            return Optional.empty();
        }
        replacePpaStudyFields(ppaId, req.studyFieldIds());
        upsertUserAccountForPpa(req.email(), ppaId, req.departmentId());
        return findPpaById(ppaId);
    }

    public void deletePpa(int ppaId) {
        HttpHeaders headers = createServiceHeaders();
        if (ppaFieldsOnStudyfieldColumn()) {
            try {
                Map<String, Object> clear = new LinkedHashMap<>();
                clear.put("ppa_id", null);
                String clearBody = objectMapper.writeValueAsString(clear);
                restTemplate.exchange(
                        supabaseUrl + "/rest/v1/studyfield?ppa_id=eq." + ppaId,
                        HttpMethod.PATCH,
                        new HttpEntity<>(clearBody, headers),
                        String.class);
            } catch (Exception ignored) {
                /* ignore */
            }
        } else {
            try {
                restTemplate.exchange(
                        supabaseUrl + "/rest/v1/" + PPA_FIELD_TABLE + "?ppa_id=eq." + ppaId,
                        HttpMethod.DELETE,
                        new HttpEntity<>(headers),
                        String.class);
            } catch (Exception ignored) {
                /* mapping rows might not exist */
            }
        }
        try {
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/useraccount?role=eq.PPA&linked_entity_id=eq." + ppaId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(headers),
                    String.class);
        } catch (Exception ignored) {
            /* account row might not exist / use different linked id */
        }
        restTemplate.exchange(
                supabaseUrl + "/rest/v1/" + PPA_TABLE + "?ppa_id=eq." + ppaId,
                HttpMethod.DELETE,
                new HttpEntity<>(headers),
                String.class);
    }

    private Optional<AdminPpaResponse> findPpaById(int ppaId) {
        String url = supabaseUrl + "/rest/v1/" + PPA_TABLE
                + "?ppa_id=eq." + ppaId + "&select=ppa_id,full_name,email,department_id,department(name)&limit=1";
        Optional<JsonNode> opt = fetchArray(url);
        if (opt.isEmpty() || !opt.get().isArray() || opt.get().isEmpty()) {
            return Optional.empty();
        }
        JsonNode n = opt.get().get(0);
        Integer id = intVal(n, "ppa_id");
        if (id == null) {
            return Optional.empty();
        }
        String departmentName = null;
        JsonNode d = n.get("department");
        if (d != null && !d.isNull()) {
            departmentName = text(d, "name");
        }
        List<AdminStudyFieldResponse> fields = loadPpaStudyFields(Set.of(id)).getOrDefault(id, List.of());
        return Optional.of(new AdminPpaResponse(
                id,
                text(n, "full_name"),
                text(n, "email"),
                intVal(n, "department_id"),
                departmentName,
                fields
        ));
    }

    private Map<Integer, List<AdminStudyFieldResponse>> loadPpaStudyFields(Set<Integer> ppaIds) {
        Map<Integer, List<AdminStudyFieldResponse>> out = new LinkedHashMap<>();
        if (ppaIds == null || ppaIds.isEmpty()) {
            return out;
        }
        String idList = ppaIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        if (ppaFieldsOnStudyfieldColumn()) {
            String url = supabaseUrl + "/rest/v1/studyfield?ppa_id=in.(" + idList
                    + ")&select=ppa_id,field_id,name,department_id";
            fetchArray(url).ifPresent(arr -> {
                if (!arr.isArray()) {
                    return;
                }
                for (JsonNode n : arr) {
                    Integer ppaId = intVal(n, "ppa_id");
                    Integer fieldId = intVal(n, "field_id");
                    if (ppaId == null || fieldId == null) {
                        continue;
                    }
                    Integer deptId = intVal(n, "department_id");
                    out.computeIfAbsent(ppaId, k -> new ArrayList<>())
                            .add(new AdminStudyFieldResponse(fieldId, text(n, "name"), deptId == null ? 0 : deptId));
                }
            });
            return out;
        }
        /* Join table: load mapping rows, then studyfield rows (no PostgREST embed — avoids relationship name mismatches). */
        String mapUrl = supabaseUrl + "/rest/v1/" + PPA_FIELD_TABLE
                + "?ppa_id=in.(" + idList + ")&select=ppa_id,field_id";
        List<int[]> pairs = new ArrayList<>();
        fetchArray(mapUrl).ifPresent(arr -> {
            if (!arr.isArray()) {
                return;
            }
            for (JsonNode n : arr) {
                Integer ppaId = intVal(n, "ppa_id");
                Integer fieldId = intVal(n, "field_id");
                if (ppaId != null && fieldId != null) {
                    pairs.add(new int[]{ppaId, fieldId});
                }
            }
        });
        if (pairs.isEmpty()) {
            return out;
        }
        Set<Integer> fieldIds = pairs.stream().map(p -> p[1]).collect(Collectors.toSet());
        String fieldIdList = fieldIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        Map<Integer, AdminStudyFieldResponse> fieldById = new LinkedHashMap<>();
        String sfUrl = supabaseUrl + "/rest/v1/studyfield?field_id=in.(" + fieldIdList
                + ")&select=field_id,name,department_id";
        fetchArray(sfUrl).ifPresent(arr -> {
            if (!arr.isArray()) {
                return;
            }
            for (JsonNode n : arr) {
                Integer fid = intVal(n, "field_id");
                if (fid == null) {
                    continue;
                }
                Integer deptId = intVal(n, "department_id");
                fieldById.put(fid, new AdminStudyFieldResponse(fid, text(n, "name"), deptId == null ? 0 : deptId));
            }
        });
        for (int[] p : pairs) {
            int ppaId = p[0];
            int fieldId = p[1];
            AdminStudyFieldResponse sf = fieldById.get(fieldId);
            if (sf != null) {
                out.computeIfAbsent(ppaId, k -> new ArrayList<>()).add(sf);
            } else {
                out.computeIfAbsent(ppaId, k -> new ArrayList<>()).add(new AdminStudyFieldResponse(fieldId, null, 0));
            }
        }
        return out;
    }

    private void replacePpaStudyFields(int ppaId, List<Integer> studyFieldIds) throws Exception {
        HttpHeaders headers = createServiceHeaders();
        if (ppaFieldsOnStudyfieldColumn()) {
            Map<String, Object> clear = new LinkedHashMap<>();
            clear.put("ppa_id", null);
            String clearBody = objectMapper.writeValueAsString(clear);
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/studyfield?ppa_id=eq." + ppaId,
                    HttpMethod.PATCH,
                    new HttpEntity<>(clearBody, headers),
                    String.class
            );
            if (studyFieldIds == null || studyFieldIds.isEmpty()) {
                return;
            }
            Set<Integer> wanted = studyFieldIds.stream().filter(v -> v != null && v > 0).collect(Collectors.toSet());
            if (wanted.isEmpty()) {
                return;
            }
            Map<String, Object> assign = new LinkedHashMap<>();
            assign.put("ppa_id", ppaId);
            String assignBody = objectMapper.writeValueAsString(assign);
            String idList = wanted.stream().map(String::valueOf).collect(Collectors.joining(","));
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/studyfield?field_id=in.(" + idList + ")",
                    HttpMethod.PATCH,
                    new HttpEntity<>(assignBody, headers),
                    String.class
            );
            return;
        }
        restTemplate.exchange(
                supabaseUrl + "/rest/v1/" + PPA_FIELD_TABLE + "?ppa_id=eq." + ppaId,
                HttpMethod.DELETE,
                new HttpEntity<>(headers),
                String.class
        );
        if (studyFieldIds == null || studyFieldIds.isEmpty()) {
            return;
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Integer fieldId : studyFieldIds) {
            if (fieldId == null || fieldId <= 0) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("ppa_id", ppaId);
            row.put("field_id", fieldId);
            rows.add(row);
        }
        if (rows.isEmpty()) {
            return;
        }
        String body = objectMapper.writeValueAsString(rows);
        restTemplate.exchange(
                supabaseUrl + "/rest/v1/" + PPA_FIELD_TABLE,
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class
        );
    }

    private void upsertUserAccountForPpa(String email, int ppaId, Integer departmentId) throws Exception {
        String linkedEntityId = String.valueOf(ppaId);
        String normalized = email.trim().toLowerCase();
        HttpHeaders headers = createServiceHeaders();
        // Ensure one PPA account row per linked approver id.
        restTemplate.exchange(
                supabaseUrl + "/rest/v1/useraccount?role=eq.PPA&linked_entity_id=eq." + ppaId,
                HttpMethod.DELETE,
                new HttpEntity<>(headers),
                String.class
        );
        String checkUrl = supabaseUrl + "/rest/v1/useraccount?email=eq." + normalized + "&select=user_id&limit=1";
        Optional<JsonNode> existing = fetchArray(checkUrl);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("email", normalized);
        payload.put("role", "PPA");
        payload.put("linked_entity_id", linkedEntityId);
        if (existing.isPresent() && existing.get().isArray() && !existing.get().isEmpty()) {
            String body = objectMapper.writeValueAsString(payload);
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/useraccount?email=eq." + normalized,
                    HttpMethod.PATCH,
                    new HttpEntity<>(body, headers),
                    String.class
            );
            return;
        }
        payload.put("password", ppaUseraccountPasswordPlaceholder);
        String body = objectMapper.writeValueAsString(payload);
        restTemplate.exchange(
                supabaseUrl + "/rest/v1/useraccount",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class
        );
    }
}
