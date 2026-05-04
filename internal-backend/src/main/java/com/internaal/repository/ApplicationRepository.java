package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.internaal.dto.ApplicationRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.StudentBrief;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class ApplicationRepository {

    private static final String PROFESSIONAL_PRACTICE_TYPE = "PROFESSIONAL_PRACTICE";
    private static final String INDIVIDUAL_GROWTH_TYPE = "INDIVIDUAL_GROWTH";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;

    public ApplicationRepository(
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

    private RuntimeException supabaseError(String url, RestClientResponseException e) {
        String body = e.getResponseBodyAsString(StandardCharsets.UTF_8);
        String hint = body;
        try {
            JsonNode n = objectMapper.readTree(body);
            if (n.has("message") && n.get("message").isTextual()) {
                hint = n.get("message").asText();
            }
        } catch (Exception ignored) {
            /* keep raw body */
        }
        return new RuntimeException(hint);
    }

    /**
     * Inserts via PostgREST. Returns empty when HTTP 2xx but no row in the body — e.g. {@code []} when RLS blocks
     * {@code return=representation} even though the row was inserted (service role can still read it on a follow-up GET).
     */
    private Optional<JsonNode> postApplicationInsert(String url, Object body) {
        try {
            String json = objectMapper.writeValueAsString(body);
            HttpHeaders headers = createServiceHeaders();
            headers.set("Prefer", "return=representation");
            HttpEntity<String> entity = new HttpEntity<>(json, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Application insert failed with status " + response.getStatusCode());
            }
            String respBody = response.getBody();
            if (respBody == null || respBody.isBlank()) {
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(respBody);
            if (root.isArray()) {
                if (root.size() > 0) {
                    return Optional.of(root.get(0));
                }
                return Optional.empty();
            }
            if (root.isObject()) {
                return Optional.of(root);
            }
        } catch (RestClientResponseException e) {
            throw supabaseError(url, e);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to submit application: " + e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * Loads {@code university_id} and {@code full_name} for routing university-scoped notifications (e.g. PPA).
     */
    public Optional<StudentBrief> findStudentBrief(Integer studentId) {
        String url = supabaseUrl + "/rest/v1/student?student_id=eq." + studentId
                + "&select=university_id,full_name&limit=1";
        Optional<JsonNode> opt = fetchArray(url);
        Optional<JsonNode> row = opt.flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
        return row.map(node -> new StudentBrief(intValue(node, "university_id"), textValue(node, "full_name")));
    }

    /**
     * When {@code false}, professional practice must not be stored (client is overridden to individual growth).
     * Missing or null PP-eligibility defaults to {@code true} for backward compatibility.
     */
    public boolean studentMayApplyForProfessionalPractice(Integer studentId) {
        String url = supabaseUrl + "/rest/v1/student?student_id=eq." + studentId
                + "&select=*&limit=1";
        Optional<JsonNode> opt = fetchArray(url);
        Optional<JsonNode> row = opt.flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
        if (row.isEmpty()) {
            return true;
        }
        Boolean allow = readCanApplyForPpFlag(row.get());
        return allow == null || allow;
    }

    /** Same name-resolution as {@link com.internaal.repository.StudentProfileRepository} for PostgREST JSON keys. */
    private Boolean readCanApplyForPpFlag(JsonNode row) {
        if (row == null || row.isNull()) {
            return null;
        }
        final String target = "canapplyforpp";
        var fields = row.fields();
        while (fields.hasNext()) {
            var e = fields.next();
            String norm = e.getKey().replace("_", "").toLowerCase();
            if (target.equals(norm) && !e.getValue().isNull()) {
                return e.getValue().asBoolean();
            }
        }
        return null;
    }

    /**
     * Reads the student's Professional Practice gate flag.
     * Forward-compatible: future Postgres triggers maintain this column when the university's admin's
     * isActive flips. Today the application layer maintains it inside SystemAdminUniversityRepository.
     * Returns {@code true} when missing or null so a misread doesn't accidentally block applications.
     */
    public boolean canStudentApplyForPP(Integer studentId) {
        if (studentId == null) {
            return true;
        }
        // select=* avoids URL-encoded quoted column names which Spring's URI template
        // processing can mangle. We read canApplyForPP by exact case in Java below.
        String url = supabaseUrl + "/rest/v1/student?student_id=eq." + studentId
                + "&select=*&limit=1";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray() || arr.get().isEmpty()) {
            return true;
        }
        JsonNode flag = arr.get().get(0).get("canApplyForPP");
        return flag == null || flag.isNull() || flag.asBoolean(true);
    }

    private Optional<JsonNode> findApplicationRow(Integer studentId, Integer opportunityId) {
        String select = APPLICATION_SELECT_BASE + ",opportunity(title),company(name)";
        String url = supabaseUrl + "/rest/v1/application?student_id=eq." + studentId
                + "&opportunity_id=eq." + opportunityId
                + "&select=" + select
                + "&order=created_at.desc&limit=1";
        return fetchArray(url).flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
    }

    private Integer intValue(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asInt() : null;
    }

    private String textValue(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asText() : null;
    }

    private Boolean boolValue(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asBoolean() : null;
    }

    public Optional<JsonNode> findOpportunityById(Integer opportunityId) {
        String url = supabaseUrl + "/rest/v1/opportunity?opportunity_id=eq." + opportunityId
                + "&select=*&limit=1";
        return fetchArray(url).flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
    }

    public Optional<ApplicationResponse> save(Integer studentId, ApplicationRequest request) {
        if (request.getOpportunityId() == null) {
            throw new RuntimeException("opportunityId is required.");
        }
        if (request.getApplicationType() == null || request.getApplicationType().isBlank()) {
            throw new RuntimeException("Application type is required.");
        }
        Optional<JsonNode> opportunityOpt = findOpportunityById(request.getOpportunityId());
        if (opportunityOpt.isEmpty()) {
            throw new RuntimeException("Opportunity not found.");
        }
        JsonNode opportunity = opportunityOpt.get();
        Integer companyId = intValue(opportunity, "company_id");
        if (companyId == null) {
            throw new RuntimeException("Opportunity has no company_id.");
        }

        String normalizedType = request.getApplicationType()
                .toUpperCase()
                .replace(" ", "_");

        if (!studentMayApplyForProfessionalPractice(studentId)
                && PROFESSIONAL_PRACTICE_TYPE.equals(normalizedType)) {
            normalizedType = INDIVIDUAL_GROWTH_TYPE;
        }

        ObjectNode body = objectMapper.createObjectNode();
        body.put("student_id", studentId);
        body.put("company_id", companyId);
        body.put("opportunity_id", request.getOpportunityId());
        body.put("application_type", normalizedType);
        body.put("accuracy_confirmed", Boolean.TRUE.equals(request.getAccuracyConfirmed()));
        // phone_number: omit until the Supabase `application` table has this column (Postgres 42703 otherwise).

        String url = supabaseUrl + "/rest/v1/application";
        Optional<JsonNode> inserted = postApplicationInsert(url, body);
        JsonNode row = inserted.orElseGet(() ->
                findApplicationRow(studentId, request.getOpportunityId())
                        .orElseThrow(() -> new RuntimeException(
                                "Application insert returned no row. If the row exists, check RLS/policies on "
                                        + "`application` for the service role and RETURNING.")));

        return Optional.of(mapToResponse(row));
    }

    /**
     * Returns total application rows per opportunity id (for student-facing opportunity cards).
     */
    public Map<Integer, Integer> countApplicationsByOpportunityIds(List<Integer> opportunityIds) {
        if (opportunityIds == null || opportunityIds.isEmpty()) {
            return Map.of();
        }
        List<Integer> distinct = opportunityIds.stream().distinct().toList();
        String inList = distinct.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/application?opportunity_id=in.(" + inList + ")&select=opportunity_id";
        Optional<JsonNode> opt = fetchArray(url);
        Map<Integer, Integer> counts = new HashMap<>();
        opt.ifPresent(arr -> {
            if (arr.isArray()) {
                for (JsonNode node : arr) {
                    Integer oid = intValue(node, "opportunity_id");
                    if (oid != null) {
                        counts.merge(oid, 1, Integer::sum);
                    }
                }
            }
        });
        return counts;
    }

    /** Matches columns that exist on `public.application` in Supabase (no phone_number until added in DB). */
    private static final String APPLICATION_SELECT_BASE =
            "application_id,student_id,company_id,opportunity_id,application_type,accuracy_confirmed,"
                    + "created_at,is_approved_by_ppa,is_approved_by_company";

    private String buildApplicationsUrl(Integer studentId, boolean withEmbeds) {
        String select = withEmbeds
                ? APPLICATION_SELECT_BASE + ",opportunity(title),company(name)"
                : APPLICATION_SELECT_BASE;
        return supabaseUrl + "/rest/v1/application?student_id=eq." + studentId
                + "&select=" + select
                + "&order=created_at.desc";
    }

    private String buildCompanyApplicationsUrl(Integer companyId, boolean withEmbeds) {
        String studentEmbed = "student(full_name,email,phone,study_year,cgpa,"
                + "university(name),department(name),studyfield(name),"
                + "studentprofile(skills,cv_url,cv_filename))";
        String select = withEmbeds
                ? APPLICATION_SELECT_BASE + ",opportunity(title),company(name)," + studentEmbed
                : APPLICATION_SELECT_BASE;
        // Hide PROFESSIONAL_PRACTICE applications until they're PPA-approved.
        // INDIVIDUAL_GROWTH applications are always visible to the company.
        String visibilityFilter =
                "or=(application_type.eq.INDIVIDUAL_GROWTH,"
                        + "and(application_type.eq.PROFESSIONAL_PRACTICE,is_approved_by_ppa.eq.true))";
        return supabaseUrl + "/rest/v1/application?company_id=eq." + companyId
                + "&" + visibilityFilter
                + "&select=" + select
                + "&order=created_at.desc";
    }

    private String buildAllApplicationsUrl(boolean withEmbeds) {
        String select = withEmbeds
                ? APPLICATION_SELECT_BASE + ",opportunity(title),company(name),student(full_name)"
                : APPLICATION_SELECT_BASE;
        return supabaseUrl + "/rest/v1/application?select=" + select + "&order=created_at.desc&limit=500";
    }

    private String buildPpaApplicationsUrl(Integer universityId, boolean withEmbeds) {
        String select = withEmbeds
                ? APPLICATION_SELECT_BASE + ",opportunity(title),company(name),student(full_name,university_id)"
                : APPLICATION_SELECT_BASE;
        return supabaseUrl + "/rest/v1/application?student.university_id=eq." + universityId
                + "&application_type=eq.PROFESSIONAL_PRACTICE"
                + "&select=" + select
                + "&order=created_at.desc&limit=500";
    }

    /**
     * Loads application rows for a GET URL. When {@code withEmbeds} is true and the request fails, returns empty
     * so callers can retry without embeds (student / company / admin lists).
     */
    private Optional<String> tryGetApplicationsFromUrl(String url, boolean withEmbeds) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(createServiceHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                String body = response.getBody();
                return Optional.of((body == null || body.isBlank()) ? "[]" : body);
            }
            return withEmbeds ? Optional.empty() : Optional.of("[]");
        } catch (RestClientResponseException e) {
            if (withEmbeds) {
                return Optional.empty();
            }
            throw supabaseError(url, e);
        } catch (Exception e) {
            throw new RuntimeException("Failed to load applications: " + e.getMessage());
        }
    }

    /**
     * Loads application rows. Tries PostgREST resource embedding first; on 4xx (unknown FK names / schema drift)
     * falls back to a plain select so students still see their applications (titles may be null).
     */
    private Optional<String> tryGetApplicationsJson(Integer studentId, boolean withEmbeds) {
        return tryGetApplicationsFromUrl(buildApplicationsUrl(studentId, withEmbeds), withEmbeds);
    }

    private List<ApplicationResponse> parseApplicationArrayJson(String json) {
        try {
            JsonNode arr = objectMapper.readTree(json);
            List<ApplicationResponse> list = new ArrayList<>();
            if (arr.isArray()) {
                arr.forEach(node -> list.add(mapToResponse(node)));
            }
            return list;
        } catch (Exception e) {
            throw new RuntimeException("Invalid applications JSON from Supabase", e);
        }
    }

    public List<ApplicationResponse> findByStudentId(Integer studentId) {
        String body = tryGetApplicationsJson(studentId, true)
                .orElseGet(() -> tryGetApplicationsJson(studentId, false).orElse("[]"));
        return parseApplicationArrayJson(body);
    }

    /**
     * Returns true if the student has applied to at least one of the given company's
     * opportunities. Used by the company-side "view applicant profile" authorization.
     */
    public boolean studentHasAppliedToCompany(int studentId, int companyId) {
        String url = supabaseUrl + "/rest/v1/application?student_id=eq." + studentId
                + "&company_id=eq." + companyId
                + "&select=application_id&limit=1";
        return fetchArray(url).map(arr -> arr.isArray() && arr.size() > 0).orElse(false);
    }

    /**
     * Lightweight ownership read used before mutating an application: returns just enough columns
     * for the service layer to decide between 404 / 403 / 409.
     */
    public Optional<JsonNode> findApplicationOwnership(int applicationId) {
        String url = supabaseUrl + "/rest/v1/application?application_id=eq." + applicationId
                + "&select=application_id,company_id,is_approved_by_company&limit=1";
        return fetchArray(url).flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
    }

    /**
     * Flips {@code is_approved_by_company} on the given application. Returns the updated row mapped
     * to {@link ApplicationResponse}, or empty if the PATCH matched zero rows. The service layer is
     * responsible for ownership and already-decided checks BEFORE calling this.
     */
    public Optional<ApplicationResponse> setCompanyDecision(int applicationId, boolean approved) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("is_approved_by_company", approved);
        HttpHeaders headers = createServiceHeaders();
        headers.set("Prefer", "return=representation");
        String url = supabaseUrl + "/rest/v1/application?application_id=eq." + applicationId;
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.PATCH,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                    String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.getBody());
            if (!root.isArray() || root.size() == 0) {
                return Optional.empty();
            }
            return Optional.of(mapToResponse(root.get(0)));
        } catch (RestClientResponseException e) {
            throw supabaseError(url, e);
        } catch (Exception e) {
            throw new RuntimeException("Failed to update application decision: " + e.getMessage());
        }
    }

    public List<ApplicationResponse> findByCompanyId(Integer companyId) {
        String body = tryGetApplicationsFromUrl(buildCompanyApplicationsUrl(companyId, true), true)
                .orElseGet(() -> tryGetApplicationsFromUrl(buildCompanyApplicationsUrl(companyId, false), false)
                        .orElse("[]"));
        return parseApplicationArrayJson(body);
    }

    public List<ApplicationResponse> findAllApplications() {
        String body = tryGetApplicationsFromUrl(buildAllApplicationsUrl(true), true)
                .orElseGet(() -> tryGetApplicationsFromUrl(buildAllApplicationsUrl(false), false).orElse("[]"));
        return parseApplicationArrayJson(body);
    }

    /**
     * Professional-practice applications from students at the given university (PostgREST filter on embedded
     * {@code student}). {@code linked_entity_id} for PPA users should hold that {@code university_id}.
     */
    public List<ApplicationResponse> findPpaQueueByUniversityId(Integer universityId) {
        String body = tryGetApplicationsFromUrl(buildPpaApplicationsUrl(universityId, true), true)
                .orElseGet(() -> tryGetApplicationsFromUrl(buildPpaApplicationsUrl(universityId, false), false)
                        .orElse("[]"));
        return parseApplicationArrayJson(body);
    }

    private ApplicationResponse mapToResponse(JsonNode node) {
        ApplicationResponse r = new ApplicationResponse();
        r.setApplicationId(intValue(node, "application_id"));
        r.setStudentId(intValue(node, "student_id"));
        r.setCompanyId(intValue(node, "company_id"));
        r.setOpportunityId(intValue(node, "opportunity_id"));
        r.setApplicationType(textValue(node, "application_type"));
        r.setPhoneNumber(textValue(node, "phone_number"));
        r.setAccuracyConfirmed(boolValue(node, "accuracy_confirmed"));
        r.setCreatedAt(textValue(node, "created_at"));

        Boolean approvedByPPA = boolValue(node, "is_approved_by_ppa");
        Boolean approvedByCompany = boolValue(node, "is_approved_by_company");
        r.setIsApprovedByPPA(approvedByPPA);
        r.setIsApprovedByCompany(approvedByCompany);

        if (Boolean.FALSE.equals(approvedByPPA) || Boolean.FALSE.equals(approvedByCompany)) {
            r.setStatus("REJECTED");
        } else if (Boolean.TRUE.equals(approvedByPPA) || Boolean.TRUE.equals(approvedByCompany)) {
            r.setStatus("APPROVED");
        } else if (approvedByPPA == null && approvedByCompany == null) {
            r.setStatus("WAITING");
        } else {
            r.setStatus("PENDING");
        }

        JsonNode opportunity = node.get("opportunity");
        if (opportunity != null && !opportunity.isNull()) {
            r.setOpportunityTitle(textValue(opportunity, "title"));
        }

        JsonNode company = node.get("company");
        if (company != null && !company.isNull()) {
            r.setCompanyName(textValue(company, "name"));
        }

        JsonNode student = node.get("student");
        if (student != null && !student.isNull()) {
            r.setStudentName(textValue(student, "full_name"));
            r.setStudentEmail(textValue(student, "email"));
            r.setStudentPhone(textValue(student, "phone"));
            r.setStudentStudyYear(intValue(student, "study_year"));
            JsonNode cgpaNode = student.get("cgpa");
            if (cgpaNode != null && !cgpaNode.isNull() && cgpaNode.isNumber()) {
                r.setStudentCgpa(cgpaNode.asDouble());
            }
            JsonNode uniNode = student.get("university");
            if (uniNode != null && !uniNode.isNull()) {
                r.setStudentUniversityName(textValue(uniNode, "name"));
            }
            JsonNode deptNode = student.get("department");
            if (deptNode != null && !deptNode.isNull()) {
                r.setStudentFacultyName(textValue(deptNode, "name"));
            }
            JsonNode fieldNode = student.get("studyfield");
            if (fieldNode != null && !fieldNode.isNull()) {
                r.setStudentFieldName(textValue(fieldNode, "name"));
            }
            JsonNode profileNode = student.get("studentprofile");
            if (profileNode != null && !profileNode.isNull()) {
                r.setStudentSkills(textValue(profileNode, "skills"));
                r.setStudentCvUrl(textValue(profileNode, "cv_url"));
                r.setStudentCvFilename(textValue(profileNode, "cv_filename"));
            }
        }

        return r;
    }
}
