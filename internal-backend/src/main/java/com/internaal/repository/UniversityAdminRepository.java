package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.AdminCompanySummaryResponse;
import com.internaal.dto.AdminDepartmentResponse;
import com.internaal.dto.AdminOpportunitySummaryResponse;
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

/**
 * Read/write catalog and student rows for university admins via PostgREST (service role).
 */
@Repository
public class UniversityAdminRepository {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;

    public UniversityAdminRepository(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon.key}") String anonKey,
            @Value("${supabase.service.role.key:}") String serviceRoleKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl;
        this.anonKey = anonKey;
        this.serviceRoleKey = serviceRoleKey;
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
                            cgpa
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
                cgpa
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
}
