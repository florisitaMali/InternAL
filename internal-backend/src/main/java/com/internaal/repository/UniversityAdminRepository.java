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
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.internaal.entity.Opportunity;

import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
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
    private static final Logger log = LoggerFactory.getLogger(UniversityAdminRepository.class);

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

    /**
     * Like {@link #fetchArray} but surfaces PostgREST HTTP failures in logs (the silent variant hides 4xx/5xx and
     * makes admin lists look “empty” when the {@code select=} embed is invalid for the deployed schema).
     */
    private Optional<JsonNode> fetchJsonBodyLogged(String url) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(createServiceHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.warn("PostgREST returned HTTP {} for GET {}", response.getStatusCode().value(), abbreviateUrlForLog(url));
                return Optional.empty();
            }
            if (response.getBody() == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readTree(response.getBody()));
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            String body = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.warn(
                    "PostgREST GET failed (HTTP {}): {}",
                    e.getStatusCode().value(),
                    body == null || body.length() < 500 ? body : body.substring(0, 500) + "…");
            return Optional.empty();
        } catch (Exception e) {
            log.warn("PostgREST GET failed for {}: {}", abbreviateUrlForLog(url), e.getMessage());
            return Optional.empty();
        }
    }

    private static String abbreviateUrlForLog(String url) {
        if (url == null) {
            return "";
        }
        int q = url.indexOf('?');
        return q > 0 ? url.substring(0, q) + "?…" : url;
    }

    private Integer intVal(JsonNode n, String field) {
        return OpportunityMapper.intVal(n, field);
    }

    private String text(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        return n.get(field).asText();
    }

    public List<AdminDepartmentResponse> listDepartmentsForUniversity(int universityId) {
        String prefix = supabaseUrl + "/rest/v1/department?university_id=eq." + universityId + "&order=name&select=";
        String urlWithUniEmbed = prefix + "department_id,name,university(name)";
        String urlPlain = prefix + "department_id,name";
        List<AdminDepartmentResponse> out = new ArrayList<>();
        Optional<JsonNode> rows = fetchJsonBodyLogged(urlWithUniEmbed).filter(JsonNode::isArray);
        if (rows.isEmpty()) {
            log.info(
                    "Retrying department list without university embed (universityId={}); add FK department.university_id → university if you need university names.",
                    universityId);
            rows = fetchJsonBodyLogged(urlPlain).filter(JsonNode::isArray);
        }
        rows.ifPresent(arr -> {
            if (!arr.isArray()) {
                return;
            }
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
        });
        return out;
    }

    /**
     * Study fields belonging to any department of {@code universityId}. When {@code departmentIdFilter} is set, restricts
     * to that department (must belong to the university).
     */
    public List<AdminStudyFieldResponse> listStudyFieldsForUniversity(int universityId, Integer departmentIdFilter) {
        if (departmentIdFilter != null) {
            Optional<Integer> owner = findUniversityIdForDepartment(departmentIdFilter);
            if (owner.isEmpty() || !owner.get().equals(universityId)) {
                return List.of();
            }
            return fetchStudyFieldsForDepartment(departmentIdFilter);
        }
        List<AdminDepartmentResponse> depts = listDepartmentsForUniversity(universityId);
        if (depts.isEmpty()) {
            return List.of();
        }
        String inList = depts.stream()
                .map(d -> String.valueOf(d.departmentId()))
                .collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/studyfield?department_id=in.(" + inList
                + ")&select=field_id,name,department_id&order=name";
        return fetchStudyFieldsFromUrl(url);
    }

    private List<AdminStudyFieldResponse> fetchStudyFieldsForDepartment(int departmentId) {
        String url = supabaseUrl + "/rest/v1/studyfield?department_id=eq." + departmentId
                + "&select=field_id,name,department_id&order=name";
        return fetchStudyFieldsFromUrl(url);
    }

    private List<AdminStudyFieldResponse> fetchStudyFieldsFromUrl(String url) {
        List<AdminStudyFieldResponse> out = new ArrayList<>();
        fetchArray(url).ifPresent(arr -> {
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

    public Optional<AdminDepartmentResponse> insertDepartment(int universityId, String name) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name.trim());
        row.put("university_id", universityId);
        String json = objectMapper.writeValueAsString(row);
        HttpHeaders headers = createServiceHeaders();
        headers.set("Prefer", "return=representation");
        HttpEntity<String> entity = new HttpEntity<>(json, headers);
        String url = supabaseUrl + "/rest/v1/department";
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null || response.getBody().isBlank()) {
            return Optional.empty();
        }
        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode first = root.isArray() && !root.isEmpty() ? root.get(0) : (root.isObject() ? root : null);
        if (first == null) {
            return Optional.empty();
        }
        Integer id = intVal(first, "department_id");
        if (id == null) {
            return Optional.empty();
        }
        String uniName = null;
        JsonNode u = first.get("university");
        if (u != null && !u.isNull()) {
            uniName = text(u, "name");
        }
        return Optional.of(new AdminDepartmentResponse(id, text(first, "name"), uniName));
    }

    public Optional<AdminStudyFieldResponse> insertStudyField(int departmentId, String name) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name.trim());
        row.put("department_id", departmentId);
        String json = objectMapper.writeValueAsString(row);
        HttpHeaders headers = createServiceHeaders();
        headers.set("Prefer", "return=representation");
        HttpEntity<String> entity = new HttpEntity<>(json, headers);
        String url = supabaseUrl + "/rest/v1/studyfield";
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null || response.getBody().isBlank()) {
            return Optional.empty();
        }
        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode first = root.isArray() && !root.isEmpty() ? root.get(0) : (root.isObject() ? root : null);
        if (first == null) {
            return Optional.empty();
        }
        Integer id = intVal(first, "field_id");
        Integer dept = intVal(first, "department_id");
        if (id == null || dept == null) {
            return Optional.empty();
        }
        return Optional.of(new AdminStudyFieldResponse(id, text(first, "name"), dept));
    }

    public Optional<Integer> findDepartmentIdForStudyField(int fieldId) {
        String url = supabaseUrl + "/rest/v1/studyfield?field_id=eq." + fieldId + "&select=department_id&limit=1";
        return fetchArray(url).flatMap(arr ->
                arr.isArray() && !arr.isEmpty()
                        ? Optional.ofNullable(intVal(arr.get(0), "department_id"))
                        : Optional.empty());
    }

    public Optional<AdminDepartmentResponse> updateDepartment(int departmentId, String name) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name.trim());
        String json = objectMapper.writeValueAsString(row);
        HttpHeaders headers = createServiceHeaders();
        headers.set("Prefer", "return=representation");
        HttpEntity<String> entity = new HttpEntity<>(json, headers);
        String url = supabaseUrl + "/rest/v1/department?department_id=eq." + departmentId;
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PATCH, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            return Optional.empty();
        }
        String respBody = response.getBody();
        if (respBody != null && !respBody.isBlank()) {
            JsonNode root = objectMapper.readTree(respBody);
            JsonNode first = root.isArray() && !root.isEmpty() ? root.get(0) : (root.isObject() ? root : null);
            if (first != null) {
                Optional<AdminDepartmentResponse> parsed = parseDepartmentResponseNode(first);
                if (parsed.isPresent()) {
                    return parsed;
                }
            }
        }
        return fetchDepartmentSummary(departmentId);
    }

    public Optional<AdminStudyFieldResponse> updateStudyField(int fieldId, int departmentId, String name) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name.trim());
        row.put("department_id", departmentId);
        String json = objectMapper.writeValueAsString(row);
        HttpHeaders headers = createServiceHeaders();
        headers.set("Prefer", "return=representation");
        HttpEntity<String> entity = new HttpEntity<>(json, headers);
        String url = supabaseUrl + "/rest/v1/studyfield?field_id=eq." + fieldId;
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PATCH, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            return Optional.empty();
        }
        String respBody = response.getBody();
        if (respBody != null && !respBody.isBlank()) {
            JsonNode root = objectMapper.readTree(respBody);
            JsonNode first = root.isArray() && !root.isEmpty() ? root.get(0) : (root.isObject() ? root : null);
            if (first != null) {
                Optional<AdminStudyFieldResponse> parsed = parseStudyFieldResponseNode(first);
                if (parsed.isPresent()) {
                    return parsed;
                }
            }
        }
        return fetchStudyFieldSummary(fieldId);
    }

    public void deleteDepartment(int departmentId) {
        String url = supabaseUrl + "/rest/v1/department?department_id=eq." + departmentId;
        HttpEntity<Void> entity = new HttpEntity<>(createServiceHeaders());
        try {
            ResponseEntity<String> res = restTemplate.exchange(url, HttpMethod.DELETE, entity, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw new IllegalStateException("HTTP " + res.getStatusCode().value());
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new IllegalStateException(truncateForMessage(e.getResponseBodyAsString(StandardCharsets.UTF_8), e.getMessage()));
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Delete failed");
        }
    }

    public void deleteStudyField(int fieldId) {
        String url = supabaseUrl + "/rest/v1/studyfield?field_id=eq." + fieldId;
        HttpEntity<Void> entity = new HttpEntity<>(createServiceHeaders());
        try {
            ResponseEntity<String> res = restTemplate.exchange(url, HttpMethod.DELETE, entity, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw new IllegalStateException("HTTP " + res.getStatusCode().value());
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new IllegalStateException(truncateForMessage(e.getResponseBodyAsString(StandardCharsets.UTF_8), e.getMessage()));
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Delete failed");
        }
    }

    private Optional<AdminDepartmentResponse> fetchDepartmentSummary(int departmentId) {
        String url = supabaseUrl + "/rest/v1/department?department_id=eq." + departmentId
                + "&select=department_id,name&limit=1";
        Optional<JsonNode> opt = fetchArray(url);
        if (opt.isEmpty() || !opt.get().isArray() || opt.get().isEmpty()) {
            return Optional.empty();
        }
        return parseDepartmentResponseNode(opt.get().get(0));
    }

    private Optional<AdminStudyFieldResponse> fetchStudyFieldSummary(int fieldId) {
        String url = supabaseUrl + "/rest/v1/studyfield?field_id=eq." + fieldId
                + "&select=field_id,name,department_id&limit=1";
        Optional<JsonNode> opt = fetchArray(url);
        if (opt.isEmpty() || !opt.get().isArray() || opt.get().isEmpty()) {
            return Optional.empty();
        }
        return parseStudyFieldResponseNode(opt.get().get(0));
    }

    private Optional<AdminDepartmentResponse> parseDepartmentResponseNode(JsonNode first) {
        Integer id = intVal(first, "department_id");
        if (id == null) {
            return Optional.empty();
        }
        String uniName = null;
        JsonNode u = first.get("university");
        if (u != null && !u.isNull()) {
            uniName = text(u, "name");
        }
        return Optional.of(new AdminDepartmentResponse(id, text(first, "name"), uniName));
    }

    private Optional<AdminStudyFieldResponse> parseStudyFieldResponseNode(JsonNode first) {
        Integer id = intVal(first, "field_id");
        Integer dept = intVal(first, "department_id");
        if (id == null || dept == null) {
            return Optional.empty();
        }
        return Optional.of(new AdminStudyFieldResponse(id, text(first, "name"), dept));
    }

    private static String truncateForMessage(String body, String fallback) {
        if (body != null && !body.isBlank()) {
            return body.length() > 400 ? body.substring(0, 400) + "…" : body;
        }
        return fallback != null ? fallback : "Request failed";
    }

    public List<AdminStudentResponse> listStudentsByUniversityId(int universityId) {
        String url = supabaseUrl + "/rest/v1/student?university_id=eq." + universityId
                + "&select=student_id,full_name,email,university_id,department_id,field_id,study_year,cgpa,"
                + "university(name),department(name),studyfield(name)"
                + "&order=full_name&limit=2000";
        return fetchStudentRows(url);
    }

    public List<AdminStudentResponse> listStudents() {
        String url = supabaseUrl + "/rest/v1/student?select=student_id,full_name,email,university_id,department_id,field_id,"
                + "study_year,cgpa,university(name),department(name),studyfield(name)"
                + "&order=full_name&limit=2000";
        return fetchStudentRows(url);
    }

    public boolean existsStudentById(int studentId) {
        String url = supabaseUrl + "/rest/v1/student?student_id=eq." + studentId + "&select=student_id&limit=1";
        return fetchArray(url).map(arr -> arr.isArray() && arr.size() > 0).orElse(false);
    }

    private static JsonNode firstRelation(JsonNode embed) {
        if (embed == null || embed.isNull()) {
            return null;
        }
        if (embed.isArray() && embed.size() > 0) {
            return embed.get(0);
        }
        return embed;
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
                    JsonNode u = firstRelation(n.get("university"));
                    if (u != null && u.isObject()) {
                        uniName = text(u, "name");
                    }
                    String studyFieldName = null;
                    JsonNode sf = firstRelation(n.get("studyfield"));
                    if (sf != null && sf.isObject()) {
                        studyFieldName = text(sf, "name");
                    }
                    String departmentName = null;
                    JsonNode dep = firstRelation(n.get("department"));
                    if (dep != null && dep.isObject()) {
                        departmentName = text(dep, "name");
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
                            studyFieldName,
                            departmentName,
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

    private static final String OPPORTUNITY_DETAIL_SELECT =
            "opportunity_id,company_id,code,title,description,"
                    + "required_skills,required_experience,deadline,start_date,type,"
                    + "position_count,job_location,work_mode,work_type,duration,salary_monthly,nice_to_have,"
                    + "is_draft,is_paid,created_at,"
                    + "company(name,location,university(name)),"
                    + "opportunitytarget(university_id,university(name),collaboration_status)";

    /** When {@code company(university(name))} is not a valid PostgREST embed for the DB schema. */
    private static final String OPPORTUNITY_DETAIL_SELECT_NO_COMPANY_UNIVERSITY =
            "opportunity_id,company_id,code,title,description,"
                    + "required_skills,required_experience,deadline,start_date,type,"
                    + "position_count,job_location,work_mode,work_type,duration,salary_monthly,nice_to_have,"
                    + "is_draft,is_paid,created_at,"
                    + "company(name,location),"
                    + "opportunitytarget(university_id,university(name),collaboration_status)";

    private static final String OPPORTUNITY_LIST_SELECT_WITH_COMPANY_UNIVERSITY =
            "opportunity_id,company_id,title,deadline,type,is_draft,description,job_location,work_mode,"
                    + "duration,required_skills,created_at,company(name,university(name)),"
                    + "opportunitytarget(university_id,university(name),collaboration_status)";

    private static final String OPPORTUNITY_LIST_SELECT_BASIC =
            "opportunity_id,company_id,title,deadline,type,is_draft,description,job_location,work_mode,"
                    + "duration,required_skills,created_at,company(name),"
                    + "opportunitytarget(university_id,university(name),collaboration_status)";

    /**
     * Published (non-draft) opportunities visible at {@code universityId}, matching student rules:
     * no {@code opportunitytarget} rows / empty targets = open to all universities; otherwise the student’s
     * {@code university_id} must appear in {@code opportunitytarget}.
     *
     * @param statusFilter {@code all}, {@code active} (deadline null or &gt;= today), or {@code expired} (deadline &lt; today)
     */
    public List<AdminOpportunitySummaryResponse> listOpportunitySummariesForUniversityAdmin(
            int universityId, String statusFilter, int limit) {
        String s = statusFilter == null ? "all" : statusFilter.trim().toLowerCase();
        final String norm = ("active".equals(s) || "expired".equals(s) || "all".equals(s)) ? s : "all";
        int cap = Math.min(Math.max(limit, 1), 500);
        String urlBasic = supabaseUrl + "/rest/v1/opportunity?select=" + OPPORTUNITY_LIST_SELECT_BASIC
                + "&order=created_at.desc&limit=1000";
        String urlFull = supabaseUrl + "/rest/v1/opportunity?select=" + OPPORTUNITY_LIST_SELECT_WITH_COMPANY_UNIVERSITY
                + "&order=created_at.desc&limit=1000";
        List<AdminOpportunitySummaryResponse> out = new ArrayList<>();
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        // Prefer the schema-safe query to avoid repeated PostgREST 400 logs when company->university FK is absent.
        Optional<JsonNode> payload = fetchJsonBodyLogged(urlBasic).filter(JsonNode::isArray);
        if (payload.isEmpty()) {
            log.info("Retrying university-admin opportunity list with company.university embed");
            payload = fetchJsonBodyLogged(urlFull).filter(JsonNode::isArray);
        }
        payload.ifPresent(arr -> {
            if (!arr.isArray()) {
                return;
            }
            for (JsonNode n : arr) {
                if (isDraftRow(n)) {
                    continue;
                }
                if (!visibleToUniversity(n, universityId)) {
                    continue;
                }
                Integer oid = intVal(n, "opportunity_id");
                if (oid == null) {
                    continue;
                }
                LocalDate dead = parseDeadlineLocalDate(text(n, "deadline"));
                boolean active = dead == null || !dead.isBefore(today);
                boolean expired = dead != null && dead.isBefore(today);
                if ("active".equals(norm) && !active) {
                    continue;
                }
                if ("expired".equals(norm) && !expired) {
                    continue;
                }
                Integer companyIdOpt = intVal(n, "company_id");
                int companyId = companyIdOpt != null ? companyIdOpt : 0;
                String companyName = null;
                String affiliatedUniversityName = null;
                JsonNode c = n.get("company");
                if (c != null && !c.isNull()) {
                    companyName = text(c, "name");
                    affiliatedUniversityName = OpportunityMapper.affiliatedUniversityFromCompanyEmbed(c);
                }
                List<String> uniNames = extractApprovedTargetUniversityNamesFromJson(n.get("opportunitytarget"));
                String viewerCollab = extractViewerCollaborationStatus(n.get("opportunitytarget"), universityId);
                List<String> skills = OpportunityMapper.skillsFromNode(n, "required_skills");
                out.add(new AdminOpportunitySummaryResponse(
                        oid,
                        companyId,
                        text(n, "title"),
                        companyName,
                        affiliatedUniversityName,
                        text(n, "deadline"),
                        text(n, "type"),
                        uniNames,
                        text(n, "description"),
                        text(n, "job_location"),
                        text(n, "work_mode"),
                        text(n, "duration"),
                        text(n, "created_at"),
                        skills,
                        0,
                        viewerCollab));
                if (out.size() >= cap) {
                    break;
                }
            }
        });
        return out;
    }

    /**
     * Published, non-draft opportunities for {@code companyId} that the university admin's institution can see —
     * same visibility rules as {@link #listOpportunitySummariesForUniversityAdmin} (includes pending per-university
     * collaboration), read with the service role so RLS does not hide rows for admin JWTs.
     */
    public List<Opportunity> listPublishedOpportunitiesForCompanyVisibleToUniversity(int companyId, int universityId) {
        if (companyId <= 0 || universityId <= 0) {
            return List.of();
        }
        String urlBasic = supabaseUrl + "/rest/v1/opportunity?company_id=eq." + companyId
                + "&select=" + OPPORTUNITY_LIST_SELECT_BASIC
                + "&order=created_at.desc&limit=500";
        String urlFull = supabaseUrl + "/rest/v1/opportunity?company_id=eq." + companyId
                + "&select=" + OPPORTUNITY_LIST_SELECT_WITH_COMPANY_UNIVERSITY
                + "&order=created_at.desc&limit=500";
        Optional<JsonNode> payload = fetchJsonBodyLogged(urlBasic).filter(JsonNode::isArray);
        if (payload.isEmpty()) {
            log.info("Retry company opportunity list with company.university embed (companyId={})", companyId);
            payload = fetchJsonBodyLogged(urlFull).filter(JsonNode::isArray);
        }
        List<Opportunity> out = new ArrayList<>();
        payload.ifPresent(arr -> {
            for (JsonNode n : arr) {
                if (isDraftRow(n)) {
                    continue;
                }
                if (!visibleToUniversity(n, universityId)) {
                    continue;
                }
                try {
                    out.add(OpportunityMapper.fromJsonNode(n));
                } catch (Exception e) {
                    log.warn("fromJsonNode failed for company {}: {}", companyId, e.getMessage());
                }
            }
        });
        return out;
    }

    /**
     * Published, non-draft opportunity by id only if it is visible to {@code universityId} (same rules as
     * {@link #listOpportunitySummariesForUniversityAdmin}).
     */
    public Optional<Opportunity> findPublishedOpportunityForUniversity(int opportunityId, int universityId) {
        String urlBasic = supabaseUrl + "/rest/v1/opportunity?opportunity_id=eq." + opportunityId
                + "&select=" + OPPORTUNITY_DETAIL_SELECT_NO_COMPANY_UNIVERSITY + "&limit=1";
        String urlFull = supabaseUrl + "/rest/v1/opportunity?opportunity_id=eq." + opportunityId
                + "&select=" + OPPORTUNITY_DETAIL_SELECT + "&limit=1";
        Optional<JsonNode> opt = fetchJsonBodyLogged(urlBasic).filter(JsonNode::isArray);
        if (opt.isEmpty() || opt.get().isEmpty()) {
            log.info("Retrying university-admin opportunity detail with company.university embed (id={})", opportunityId);
            opt = fetchJsonBodyLogged(urlFull).filter(JsonNode::isArray);
        }
        if (opt.isEmpty() || opt.get().isEmpty()) {
            return Optional.empty();
        }
        JsonNode n = opt.get().get(0);
        if (isDraftRow(n)) {
            return Optional.empty();
        }
        if (!visibleToUniversity(n, universityId)) {
            return Optional.empty();
        }
        return Optional.of(OpportunityMapper.fromJsonNode(n));
    }

    /**
     * Mirrors student visibility: no targets / null / empty array = open to all universities; otherwise
     * {@code universityId} must appear in {@code opportunitytarget}. PostgREST may return {@code opportunitytarget}
     * as an array or a single embedded object.
     */
    private static boolean visibleToUniversity(JsonNode opportunityNode, int universityId) {
        JsonNode targets = opportunityNode.get("opportunitytarget");
        if (targets == null || targets.isNull()) {
            return true;
        }
        if (targets.isObject()) {
            Integer uid = OpportunityMapper.intVal(targets, "university_id");
            return uid != null && uid == universityId;
        }
        if (!targets.isArray()) {
            return true;
        }
        if (targets.isEmpty()) {
            return true;
        }
        for (JsonNode t : targets) {
            Integer uid = OpportunityMapper.intVal(t, "university_id");
            if (uid != null && uid == universityId) {
                return true;
            }
        }
        return false;
    }

    private boolean isDraftRow(JsonNode n) {
        Boolean b = OpportunityMapper.boolVal(n, "is_draft");
        return Boolean.TRUE.equals(b);
    }

    private static LocalDate parseDeadlineLocalDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
        try {
            if (s.length() >= 10) {
                return LocalDate.parse(s.substring(0, 10));
            }
            return LocalDate.parse(s);
        } catch (Exception ignored) {
            return null;
        }
    }

    public List<Integer> listActiveUniversityAdminUserIds(int universityId) {
        if (universityId <= 0) {
            return List.of();
        }
        String url = supabaseUrl + "/rest/v1/useraccount?role=eq.UNIVERSITY_ADMIN&linked_entity_id=eq." + universityId
                + "&isActive=eq.true&select=user_id";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray()) {
            return List.of();
        }
        List<Integer> out = new ArrayList<>();
        for (JsonNode row : arr.get()) {
            Integer uid = intVal(row, "user_id");
            if (uid != null) {
                out.add(uid);
            }
        }
        return out;
    }

    /** Loads {@code university.name} for notification copy (service-key GET). */
    public Optional<String> findUniversityNameById(int universityId) {
        if (universityId <= 0) {
            return Optional.empty();
        }
        String url = supabaseUrl + "/rest/v1/university?university_id=eq." + universityId
                + "&select=name&limit=1";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray() || arr.get().isEmpty()) {
            return Optional.empty();
        }
        JsonNode row = arr.get().get(0);
        if (row == null || !row.has("name") || row.get("name").isNull()) {
            return Optional.empty();
        }
        String name = row.get("name").asText();
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(name.trim());
    }

    private List<String> extractApprovedTargetUniversityNamesFromJson(JsonNode targetsNode) {
        List<String> names = new ArrayList<>();
        if (targetsNode == null || targetsNode.isNull()) {
            return names;
        }
        if (targetsNode.isObject()) {
            if (isApprovedCollaborationRow(targetsNode)) {
                String label = resolveOneTargetUniversityLabel(targetsNode);
                if (label != null && !label.isBlank() && !"—".equals(label)) {
                    names.add(label);
                }
            }
            return names;
        }
        if (!targetsNode.isArray()) {
            return names;
        }
        for (JsonNode t : targetsNode) {
            if (isApprovedCollaborationRow(t)) {
                String label = resolveOneTargetUniversityLabel(t);
                if (label != null && !label.isBlank() && !"—".equals(label)) {
                    names.add(label);
                }
            }
        }
        return names;
    }

    private boolean isApprovedCollaborationRow(JsonNode t) {
        if (t == null || t.isNull()) {
            return false;
        }
        String st = text(t, "collaboration_status");
        if (st == null || st.isBlank()) {
            return true;
        }
        return "APPROVED".equalsIgnoreCase(st.trim());
    }

    /**
     * Collaboration status for {@code universityId} on this opportunity’s targets; null if listing is not targeted
     * to a specific row for this university (e.g. open to all universities).
     */
    private String extractViewerCollaborationStatus(JsonNode targetsNode, int universityId) {
        if (targetsNode == null || targetsNode.isNull()) {
            return null;
        }
        if (targetsNode.isObject()) {
            Integer uid = intVal(targetsNode, "university_id");
            if (uid != null && uid == universityId) {
                return normalizeCollaborationStatusToken(text(targetsNode, "collaboration_status"));
            }
            return null;
        }
        if (!targetsNode.isArray() || targetsNode.isEmpty()) {
            return null;
        }
        for (JsonNode t : targetsNode) {
            Integer uid = intVal(t, "university_id");
            if (uid != null && uid == universityId) {
                return normalizeCollaborationStatusToken(text(t, "collaboration_status"));
            }
        }
        return null;
    }

    private static String normalizeCollaborationStatusToken(String raw) {
        if (raw == null || raw.isBlank()) {
            return "APPROVED";
        }
        String u = raw.trim().toUpperCase();
        if ("PENDING".equals(u) || "REJECTED".equals(u) || "APPROVED".equals(u)) {
            return u;
        }
        return "APPROVED";
    }

    private String resolveOneTargetUniversityLabel(JsonNode t) {
        String name = null;
        JsonNode u = t.get("university");
        if (u != null && !u.isNull()) {
            JsonNode uni = u.isArray() && !u.isEmpty() ? u.get(0) : u;
            if (uni != null && !uni.isNull()) {
                name = text(uni, "name");
            }
        }
        if (name == null || name.isBlank()) {
            Integer uid = intVal(t, "university_id");
            name = uid != null ? ("University " + uid) : "—";
        }
        return name;
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

    public Optional<AdminPpaResponse> getPpaProfile(int ppaId) {
        return findPpaById(ppaId);
    }

    /**
     * Supabase Auth UUID for this PPA's {@code useraccount} row, when {@code supabase_user_id} is set (after login).
     */
    public Optional<String> findSupabaseAuthUserIdForPpa(int ppaId) {
        String url = supabaseUrl + "/rest/v1/useraccount?role=eq.PPA&linked_entity_id=eq." + ppaId
                + "&select=supabase_user_id&limit=1";
        Optional<JsonNode> opt = fetchArray(url);
        if (opt.isEmpty() || !opt.get().isArray() || opt.get().isEmpty()) {
            return Optional.empty();
        }
        JsonNode n = opt.get().get(0);
        if (!n.has("supabase_user_id") || n.get("supabase_user_id").isNull()) {
            return Optional.empty();
        }
        String id = n.get("supabase_user_id").asText(null);
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(id.trim());
    }

    public Optional<Integer> findDepartmentIdForPpa(int ppaId) {
        String url = supabaseUrl + "/rest/v1/" + PPA_TABLE
                + "?ppa_id=eq." + ppaId + "&select=department_id&limit=1";
        Optional<JsonNode> opt = fetchArray(url);
        if (opt.isEmpty() || !opt.get().isArray() || opt.get().isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(intVal(opt.get().get(0), "department_id"));
    }

    public Optional<String> getCollaborationStatus(int opportunityId, int universityId) {
        String url = supabaseUrl + "/rest/v1/opportunitytarget?opportunity_id=eq." + opportunityId
                + "&university_id=eq." + universityId + "&select=collaboration_status&limit=1";
        Optional<JsonNode> opt = fetchJsonBodyLogged(url).filter(JsonNode::isArray);
        if (opt.isEmpty() || !opt.get().isArray() || opt.get().isEmpty()) {
            return Optional.empty();
        }
        JsonNode row = opt.get().get(0);
        String st = text(row, "collaboration_status");
        if (st == null || st.isBlank()) {
            return Optional.of("PENDING");
        }
        return Optional.of(st.trim());
    }

    public void patchCollaborationStatus(int opportunityId, int universityId, String status) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("collaboration_status", status);
            String json = objectMapper.writeValueAsString(body);
            String url = supabaseUrl + "/rest/v1/opportunitytarget?opportunity_id=eq." + opportunityId
                    + "&university_id=eq." + universityId;
            restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(json, createServiceHeaders()),
                    String.class);
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.warn("patchCollaborationStatus failed: HTTP {}", e.getStatusCode().value());
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(
                    e.getMessage() != null ? e.getMessage() : "Could not update collaboration status");
        }
    }

    /**
     * Persists Supabase Auth user id (JWT {@code sub}) on useraccount when the column exists.
     */
    public void tryLinkSupabaseUserToAccount(Integer userId, String supabaseSub) {
        if (userId == null || supabaseSub == null || supabaseSub.isBlank()) {
            return;
        }
        try {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("supabase_user_id", supabaseSub);
            String body = objectMapper.writeValueAsString(row);
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/useraccount?user_id=eq." + userId,
                    HttpMethod.PATCH,
                    new HttpEntity<>(body, createServiceHeaders()),
                    String.class);
        } catch (Exception ignored) {
            /* Column may be missing until migration is applied. */
        }
    }
}
