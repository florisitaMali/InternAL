package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.AdminStudentResponse;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class PpaRepository {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;

    public PpaRepository(
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
        } catch (Exception e) {
            /* non-2xx or parse failure — caller treats as empty */
        }
        return Optional.empty();
    }

    private Integer intVal(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asInt() : null;
    }

    private String textVal(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asText() : null;
    }

    private Boolean boolVal(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asBoolean() : null;
    }

    public List<Integer> getPpaFieldIds(int ppaId) {
        String url = supabaseUrl + "/rest/v1/ppa_studyfield?ppa_id=eq." + ppaId + "&select=field_id";
        List<Integer> ids = new ArrayList<>();
        fetchArray(url).ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    Integer fid = intVal(n, "field_id");
                    if (fid != null) ids.add(fid);
                }
            }
        });
        return ids;
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
                    String fieldName = null;
                    JsonNode sf = n.get("studyfield");
                    if (sf != null && !sf.isNull()) {
                        fieldName = textVal(sf, "name");
                    }
                    String deptName = null;
                    JsonNode dept = n.get("department");
                    if (dept != null && !dept.isNull()) {
                        deptName = textVal(dept, "name");
                    }
                    BigDecimal cgpa = null;
                    if (n.has("cgpa") && !n.get("cgpa").isNull()) {
                        cgpa = n.get("cgpa").decimalValue();
                    }
                    out.add(new AdminStudentResponse(
                            sid,
                            textVal(n, "full_name"),
                            textVal(n, "email"),
                            null,
                            intVal(n, "department_id"),
                            deptName,
                            intVal(n, "field_id"),
                            intVal(n, "study_year"),
                            cgpa,
                            fieldName,
                            null,
                            null
                    ));
                }
            }
        });
        return out;
    }

    public List<AdminStudentResponse> listStudentsByFieldIds(List<Integer> fieldIds) {
        String inList = fieldIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/student?field_id=in.(" + inList + ")"
                + "&select=student_id,full_name,email,study_year,cgpa,field_id,studyfield(name)"
                + "&order=full_name";
        return fetchStudentRows(url);
    }

    /** Students in one of the fields and in the given department (PPA scope). */
    public List<AdminStudentResponse> listStudentsByFieldIdsAndDepartment(List<Integer> fieldIds, int departmentId) {
        if (fieldIds == null || fieldIds.isEmpty()) {
            return List.of();
        }
        String inList = fieldIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/student?field_id=in.(" + inList + ")"
                + "&department_id=eq." + departmentId
                + "&select=student_id,full_name,email,study_year,cgpa,field_id,department_id,"
                + "studyfield(name),department(name)"
                + "&order=full_name";
        return fetchStudentRows(url);
    }

    public Map<Integer, int[]> getApplicationStatsByStudentIds(List<Integer> studentIds) {
        String inList = studentIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/application?student_id=in.(" + inList + ")"
                + "&select=student_id,is_approved_by_ppa,is_approved_by_company";
        Map<Integer, List<JsonNode>> grouped = new HashMap<>();
        fetchArray(url).ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    Integer sid = intVal(n, "student_id");
                    if (sid == null) continue;
                    grouped.computeIfAbsent(sid, k -> new ArrayList<>()).add(n);
                }
            }
        });

        Map<Integer, int[]> result = new HashMap<>();
        for (Map.Entry<Integer, List<JsonNode>> entry : grouped.entrySet()) {
            List<JsonNode> apps = entry.getValue();
            int count = apps.size();
            int status = deriveOverallStatus(apps);
            result.put(entry.getKey(), new int[]{count, status});
        }
        return result;
    }

    // Status encoding: 0=WAITING, 1=PENDING, 2=APPROVED, 3=REJECTED
    private int deriveOverallStatus(List<JsonNode> apps) {
        boolean anyRejected = false;
        boolean anyApproved = false;
        boolean anyPending = false;
        for (JsonNode n : apps) {
            Boolean byPpa = boolVal(n, "is_approved_by_ppa");
            Boolean byCompany = boolVal(n, "is_approved_by_company");
            if (Boolean.FALSE.equals(byPpa) || Boolean.FALSE.equals(byCompany)) {
                anyRejected = true;
            } else if (Boolean.TRUE.equals(byPpa) || Boolean.TRUE.equals(byCompany)) {
                anyApproved = true;
            } else if (byPpa != null || byCompany != null) {
                anyPending = true;
            }
        }
        if (anyRejected) return 3;
        if (anyApproved) return 2;
        if (anyPending) return 1;
        return 0;
    }

    public static String statusLabel(int code) {
        return switch (code) {
            case 3 -> "REJECTED";
            case 2 -> "APPROVED";
            case 1 -> "PENDING";
            default -> "WAITING";
        };
    }

    /**
     * Department assigned to this PPA on {@code professionalpracticeapprover}.
     */
    public Optional<Integer> findDepartmentIdByPpaId(int ppaId) {
        String url = supabaseUrl + "/rest/v1/professionalpracticeapprover?ppa_id=eq." + ppaId
                + "&select=department_id&limit=1";
        return fetchArray(url).flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.ofNullable(intVal(arr.get(0), "department_id")) : Optional.empty());
    }

    /**
     * True if the student belongs to this PPA&apos;s department and study field assignment.
     */
    public boolean ppaCoversStudent(int ppaId, int studentId) {
        Optional<Integer> deptOpt = findDepartmentIdByPpaId(ppaId);
        List<Integer> fields = getPpaFieldIds(ppaId);
        if (deptOpt.isEmpty() || fields.isEmpty()) {
            return false;
        }
        int dept = deptOpt.get();
        String inList = fields.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/student?student_id=eq." + studentId
                + "&department_id=eq." + dept
                + "&field_id=in.(" + inList + ")"
                + "&select=student_id&limit=1";
        return fetchArray(url).map(arr -> arr.isArray() && arr.size() > 0).orElse(false);
    }
}
