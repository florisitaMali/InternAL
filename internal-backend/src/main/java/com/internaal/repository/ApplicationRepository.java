package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.internaal.dto.ApplicationRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.OpportunityApplicationStatsDto;
import com.internaal.dto.StalePpaReminderRow;
import com.internaal.dto.StudentBrief;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class ApplicationRepository {

    private static final String PROFESSIONAL_PRACTICE_TYPE = "PROFESSIONAL_PRACTICE";
    private static final String INDIVIDUAL_GROWTH_TYPE = "INDIVIDUAL_GROWTH";
    /** PostgREST filter URLs with many ids are capped to keep requests well under typical limits. */
    private static final int PPA_APPLICATION_STUDENT_ID_CHUNK = 120;

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
        String select = APPLICATION_COMPANY_EMBEDS;
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

        ApplicationResponse mapped = mapToResponse(row);
        /** Insert/fallback rows often omit embedded {@code opportunity(title)}; we already loaded this row above. */
        String titleFromOpportunity = textValue(opportunity, "title");
        if (titleFromOpportunity != null && !titleFromOpportunity.isBlank()) {
            mapped.setOpportunityTitle(titleFromOpportunity.trim());
        }

        return Optional.of(mapped);
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

    /** Rich {@code student} embed for company application lists (names joined via FK embeds). */
    private static final String APPLICATION_COMPANY_EMBEDS =
            APPLICATION_SELECT_BASE
                    + ",opportunity(title),company(name),student(full_name,email,phone,study_year,cgpa,"
                    + "university(name),department(name),studyfield(name),studentprofile(skills,cv_url,cv_filename))";

    private String buildApplicationsUrl(Integer studentId, boolean withEmbeds) {
        String select = withEmbeds
                ? APPLICATION_SELECT_BASE + ",opportunity(title,type),company(name)"
                : APPLICATION_SELECT_BASE;
        return supabaseUrl + "/rest/v1/application?student_id=eq." + studentId
                + "&select=" + select
                + "&order=created_at.desc";
    }

    private String buildCompanyApplicationsUrl(Integer companyId, boolean withEmbeds) {
        // Hide PROFESSIONAL_PRACTICE applications until they're PPA-approved.
        // INDIVIDUAL_GROWTH applications are always visible to the company.
        String visibilityFilter =
                "or=(application_type.eq.INDIVIDUAL_GROWTH,"
                        + "and(application_type.eq.PROFESSIONAL_PRACTICE,is_approved_by_ppa.eq.true))";
        String select = withEmbeds ? APPLICATION_COMPANY_EMBEDS : APPLICATION_SELECT_BASE;
        return supabaseUrl + "/rest/v1/application?company_id=eq." + companyId
                + "&" + visibilityFilter
                + "&select=" + select
                + "&order=created_at.desc";
    }

    private String buildAllApplicationsUrl(boolean withEmbeds) {
        String select = withEmbeds
                ? APPLICATION_SELECT_BASE + ",opportunity(title,type),company(name),student(full_name)"
                : APPLICATION_SELECT_BASE;
        return supabaseUrl + "/rest/v1/application?select=" + select + "&order=created_at.desc&limit=500";
    }

    private String buildPpaApplicationsUrl(Integer universityId, boolean withEmbeds) {
        String select = withEmbeds
                ? APPLICATION_SELECT_BASE + ",opportunity(title,type),company(name),student(full_name,university_id)"
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
            return Optional.of(enrichCompanyApplicantProfile(mapToResponse(root.get(0))));
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
        List<ApplicationResponse> list = parseApplicationArrayJson(body);
        enrichCompanyApplicantsFromStudentTable(list);
        return list;
    }

    /**
     * Counts all application rows for a company opportunity. Does not use the PPA “visibility” filter on
     * {@link #findByCompanyId}, so detail-page totals include Professional Practice applications still pending PPA.
     */
    public OpportunityApplicationStatsDto statsForCompanyOpportunity(int companyId, int opportunityId) {
        String url = supabaseUrl + "/rest/v1/application"
                + "?company_id=eq." + companyId
                + "&opportunity_id=eq." + opportunityId
                + "&select=is_approved_by_company";
        Optional<JsonNode> opt = fetchArray(url);
        int total = 0;
        int inReview = 0;
        int approved = 0;
        int rejected = 0;
        if (opt.isPresent() && opt.get().isArray()) {
            for (JsonNode row : opt.get()) {
                total++;
                Boolean c = boolValue(row, "is_approved_by_company");
                if (Boolean.TRUE.equals(c)) {
                    approved++;
                } else if (Boolean.FALSE.equals(c)) {
                    rejected++;
                } else {
                    inReview++;
                }
            }
        }
        return new OpportunityApplicationStatsDto(total, inReview, approved, rejected);
    }

    public List<ApplicationResponse> findAllApplications() {
        String body = tryGetApplicationsFromUrl(buildAllApplicationsUrl(true), true)
                .orElseGet(() -> tryGetApplicationsFromUrl(buildAllApplicationsUrl(false), false).orElse("[]"));
        return parseApplicationArrayJson(body);
    }

    /**
     * Students in the PPA&apos;s department and assigned study fields ({@code field_id}, {@code department_id}),
     * same scope as {@link com.internaal.repository.PpaRepository#listStudentsByFieldIdsAndDepartment}.
     */
    private List<Integer> listStudentIdsForPpaScope(int departmentId, List<Integer> fieldIds) {
        if (fieldIds == null || fieldIds.isEmpty()) {
            return List.of();
        }
        String inList = fieldIds.stream().map(String::valueOf).distinct().collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/student?field_id=in.(" + inList + ")"
                + "&department_id=eq." + departmentId
                + "&select=student_id"
                + "&limit=5000";
        try {
            HttpEntity<Void> entity = new HttpEntity<>(createServiceHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return List.of();
            }
            JsonNode arr = objectMapper.readTree(response.getBody());
            List<Integer> out = new ArrayList<>();
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    Integer id = intValue(n, "student_id");
                    if (id != null) {
                        out.add(id);
                    }
                }
            }
            return out.stream().distinct().collect(Collectors.toList());
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * For PPA users: {@code PROFESSIONAL_PRACTICE} only; students in scope are resolved explicitly (same rules as
     * the PPA student list) then applications are loaded with {@code student_id=in.(...)}. Nested filters on the
     * embedded {@code student} resource were unreliable and could omit rows.
     */
    public List<ApplicationResponse> findPpaApplicationsForApproverScope(int departmentId, List<Integer> fieldIds) {
        if (fieldIds == null || fieldIds.isEmpty()) {
            return List.of();
        }
        List<Integer> studentIds = listStudentIdsForPpaScope(departmentId, fieldIds);
        if (studentIds.isEmpty()) {
            return List.of();
        }
        String select = APPLICATION_SELECT_BASE + ",opportunity(title,type),company(name),student(full_name)";
        List<ApplicationResponse> merged = new ArrayList<>();
        for (int i = 0; i < studentIds.size(); i += PPA_APPLICATION_STUDENT_ID_CHUNK) {
            int end = Math.min(i + PPA_APPLICATION_STUDENT_ID_CHUNK, studentIds.size());
            List<Integer> chunk = studentIds.subList(i, end);
            String inList = chunk.stream().map(String::valueOf).collect(Collectors.joining(","));
            String url = supabaseUrl + "/rest/v1/application"
                    + "?student_id=in.(" + inList + ")"
                    + "&application_type=eq.PROFESSIONAL_PRACTICE"
                    + "&select=" + select
                    + "&order=created_at.desc&limit=500";
            String body = tryGetApplicationsFromUrl(url, true)
                    .orElseGet(() -> tryGetApplicationsFromUrl(url, false).orElse("[]"));
            merged.addAll(parseApplicationArrayJson(body));
        }
        Map<Integer, ApplicationResponse> byAppId = new LinkedHashMap<>();
        List<ApplicationResponse> withoutId = new ArrayList<>();
        for (ApplicationResponse r : merged) {
            if (r.getApplicationId() != null) {
                byAppId.putIfAbsent(r.getApplicationId(), r);
            } else {
                withoutId.add(r);
            }
        }
        List<ApplicationResponse> result = new ArrayList<>(byAppId.values());
        result.addAll(withoutId);
        result.sort(Comparator.comparing(ApplicationResponse::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return result;
    }

    /**
     * Professional-practice applications from students at the given university. Used for university admins;
     * {@code linked_entity_id} should be {@code university_id}.
     */
    public List<ApplicationResponse> findPpaQueueByUniversityId(Integer universityId) {
        String body = tryGetApplicationsFromUrl(buildPpaApplicationsUrl(universityId, true), true)
                .orElseGet(() -> tryGetApplicationsFromUrl(buildPpaApplicationsUrl(universityId, false), false)
                        .orElse("[]"));
        return parseApplicationArrayJson(body);
    }

    /**
     * Loads a single application by primary key (with list-style embeds).
     */
    public Optional<ApplicationResponse> findByApplicationId(int applicationId) {
        String select = APPLICATION_SELECT_BASE + ",opportunity(title,type),company(name),student(full_name)";
        String url = supabaseUrl + "/rest/v1/application?application_id=eq." + applicationId
                + "&select=" + select
                + "&limit=1";
        String body = tryGetApplicationsFromUrl(url, true)
                .orElseGet(() -> tryGetApplicationsFromUrl(url, false).orElse("[]"));
        List<ApplicationResponse> list = parseApplicationArrayJson(body);
        if (list.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(list.get(0));
    }

    /**
     * Updates {@code is_approved_by_ppa} using the service role (bypasses RLS when configured).
     */
    public boolean patchIsApprovedByPpa(int applicationId, boolean approved) {
        try {
            String url = supabaseUrl + "/rest/v1/application?application_id=eq." + applicationId;
            HttpHeaders headers = createServiceHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Prefer", "return=minimal");
            Map<String, Object> patch = new HashMap<>();
            patch.put("is_approved_by_ppa", approved);
            String json = objectMapper.writeValueAsString(patch);
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(json, headers),
                    String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (RestClientResponseException e) {
            return false;
        } catch (Exception e) {
            return false;
        }
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

        JsonNode opportunity = firstEmbed(node.get("opportunity"));
        if (opportunity != null && !opportunity.isNull()) {
            r.setOpportunityTitle(textValue(opportunity, "title"));
            r.setOpportunityType(textValue(opportunity, "type"));
        }

        JsonNode company = firstEmbed(node.get("company"));
        if (company != null && !company.isNull()) {
            r.setCompanyName(textValue(company, "name"));
        }

        JsonNode student = firstEmbed(node.get("student"));
        mergeStudentEmbedIntoResponse(student, r);

        return r;
    }

    /**
     * Copies applicant profile fields from an embedded or standalone {@code student} JSON row into {@code r}.
     */
    private void mergeStudentEmbedIntoResponse(JsonNode student, ApplicationResponse r) {
        if (student == null || student.isNull()) {
            return;
        }
        String fn = textValue(student, "full_name");
        if (fn != null && !fn.isBlank()) {
            r.setStudentName(fn.trim());
        }
        String em = textValue(student, "email");
        if (em != null && !em.isBlank()) {
            r.setStudentEmail(em.trim());
        }
        String ph = textValue(student, "phone");
        if (ph != null && !ph.isBlank()) {
            r.setStudentPhone(ph.trim());
        }
        JsonNode sy = student.get("study_year");
        if (sy != null && !sy.isNull() && sy.isNumber()) {
            r.setStudentStudyYear(sy.asInt());
        }
        JsonNode cg = student.get("cgpa");
        if (cg != null && !cg.isNull() && cg.isNumber()) {
            r.setStudentCgpa(cg.doubleValue());
        }
        JsonNode uni = firstEmbed(student.get("university"));
        if (uni != null && !uni.isNull()) {
            String un = textValue(uni, "name");
            if (un != null && !un.isBlank()) {
                r.setStudentUniversityName(un.trim());
            }
        }
        JsonNode dept = firstEmbed(student.get("department"));
        if (dept != null && !dept.isNull()) {
            String dn = textValue(dept, "name");
            if (dn != null && !dn.isBlank()) {
                String t = dn.trim();
                r.setStudentDepartmentName(t);
                r.setStudentFacultyName(t);
            }
        }
        JsonNode studyfield = firstEmbed(student.get("studyfield"));
        if (studyfield != null && !studyfield.isNull()) {
            String sf = textValue(studyfield, "name");
            if (sf != null && !sf.isBlank()) {
                String t = sf.trim();
                r.setStudentStudyFieldName(t);
                r.setStudentFieldName(t);
            }
        }
        JsonNode profile = firstEmbed(student.get("studentprofile"));
        if (profile != null && !profile.isNull()) {
            String skills = textValue(profile, "skills");
            if (skills != null && !skills.isBlank()) {
                r.setStudentSkills(skills.trim());
            }
            String cvUrl = textValue(profile, "cv_url");
            if (cvUrl != null && !cvUrl.isBlank()) {
                r.setStudentCvUrl(cvUrl.trim());
            }
            String cv = textValue(profile, "cv_filename");
            if (cv != null && !cv.isBlank()) {
                r.setStudentCvFilename(cv.trim());
            }
        }
    }

    /**
     * PostgREST embeds on {@code application} often omit student columns; batch-load {@code student} rows by id.
     */
    private void enrichCompanyApplicantsFromStudentTable(List<ApplicationResponse> applications) {
        if (applications == null || applications.isEmpty()) {
            return;
        }
        List<Integer> ids = applications.stream()
                .map(ApplicationResponse::getStudentId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Integer, JsonNode> byStudentId = fetchStudentRowsForEnrichment(ids);
        for (ApplicationResponse r : applications) {
            Integer sid = r.getStudentId();
            if (sid == null) {
                continue;
            }
            JsonNode st = byStudentId.get(sid);
            if (st != null && !st.isNull()) {
                mergeStudentEmbedIntoResponse(st, r);
            }
        }
    }

    private Map<Integer, JsonNode> fetchStudentRowsForEnrichment(List<Integer> studentIds) {
        String inList = studentIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String[] trySelects = new String[] {
                "student_id,full_name,email,phone,study_year,cgpa,university(name),studyfield(name),department(name),studentprofile(skills,cv_url,cv_filename)",
                "student_id,full_name,email,phone,study_year,cgpa,university(name),studyfield(name),department(name),studentprofile(cv_filename)",
                "student_id,full_name,email,phone,study_year,cgpa,university(name),studyfield(name),studentprofile(cv_filename)",
                "student_id,full_name,email,phone,study_year,cgpa,university(name),studyfield(name)",
                "student_id,full_name,email,phone,study_year,cgpa,university(name)",
                "student_id,full_name,email,phone,study_year,cgpa"
        };
        for (String sel : trySelects) {
            String url = supabaseUrl + "/rest/v1/student?student_id=in.(" + inList + ")&select=" + sel;
            Optional<JsonNode> opt = fetchArray(url);
            if (opt.isEmpty()) {
                continue;
            }
            JsonNode arr = opt.get();
            if (!arr.isArray() || arr.isEmpty()) {
                return Map.of();
            }
            Map<Integer, JsonNode> out = new HashMap<>();
            for (JsonNode n : arr) {
                Integer sid = intValue(n, "student_id");
                if (sid != null) {
                    out.put(sid, n);
                }
            }
            return out;
        }
        return Map.of();
    }

    /** Ensures a single application row returned after PATCH has full applicant fields for company UI. */
    public ApplicationResponse enrichCompanyApplicantProfile(ApplicationResponse r) {
        if (r != null && r.getStudentId() != null) {
            enrichCompanyApplicantsFromStudentTable(List.of(r));
        }
        return r;
    }

    /** PostgREST may return an embedded row as an object or a single-element array. */
    private static JsonNode firstEmbed(JsonNode embed) {
        if (embed == null || embed.isNull()) {
            return null;
        }
        if (embed.isArray() && embed.size() > 0) {
            return embed.get(0);
        }
        return embed;
    }

    /**
     * Loads opportunity title for notifications when the application row embed did not include {@code opportunity.title}.
     */
    public Optional<String> findOpportunityTitleById(Integer opportunityId) {
        if (opportunityId == null) {
            return Optional.empty();
        }
        return findOpportunityById(opportunityId).flatMap(node -> {
            String t = textValue(node, "title");
            if (t == null || t.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(t.trim());
        });
    }

    /**
     * Loads opportunity title via application row (when embed omitted title on insert or patch responses).
     */
    public Optional<String> findOpportunityTitleByApplicationId(int applicationId) {
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/application")
                .queryParam("application_id", "eq." + applicationId)
                .queryParam("select", "opportunity(title)")
                .queryParam("limit", "1")
                .build(false)
                .encode()
                .toUriString();
        Optional<JsonNode> opt = fetchArray(url);
        Optional<JsonNode> row = opt.flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
        if (row.isEmpty()) {
            return Optional.empty();
        }
        JsonNode opportunity = firstEmbed(row.get().get("opportunity"));
        if (opportunity == null) {
            return Optional.empty();
        }
        String title = textValue(opportunity, "title");
        if (title == null || title.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(title.trim());
    }

    private static final String OPPORTUNITY_TITLE_FALLBACK = "this listing";

    /**
     * Resolves the listing title for notification copy: embedded title, then DB by opportunity id, then by application id.
     */
    public String resolveOpportunityTitleForNotification(ApplicationResponse app) {
        if (app == null) {
            return OPPORTUNITY_TITLE_FALLBACK;
        }
        String t = app.getOpportunityTitle();
        if (t != null && !t.isBlank()) {
            return t.trim();
        }
        Integer oid = app.getOpportunityId();
        if (oid != null) {
            Optional<String> fromOpp = findOpportunityTitleById(oid);
            if (fromOpp.isPresent()) {
                return fromOpp.get();
            }
        }
        Integer aid = app.getApplicationId();
        if (aid != null) {
            Optional<String> fromApp = findOpportunityTitleByApplicationId(aid);
            if (fromApp.isPresent()) {
                return fromApp.get();
            }
        }
        return OPPORTUNITY_TITLE_FALLBACK;
    }

    /**
     * Title for stale PP reminders when the scheduled query did not return {@code opportunity.title}.
     */
    public String resolveOpportunityTitleForStaleReminder(StalePpaReminderRow row) {
        if (row != null && row.opportunityTitle() != null && !row.opportunityTitle().isBlank()) {
            return row.opportunityTitle().trim();
        }
        if (row == null) {
            return OPPORTUNITY_TITLE_FALLBACK;
        }
        return findOpportunityTitleByApplicationId(row.applicationId()).orElse(OPPORTUNITY_TITLE_FALLBACK);
    }

    /**
     * Professional-practice rows still awaiting {@code is_approved_by_ppa}, submitted before the cutoff.
     */
    public List<StalePpaReminderRow> findProfessionalPracticePendingOlderThanDays(int olderThanDays) {
        Instant cutoff = Instant.now().minus(olderThanDays, ChronoUnit.DAYS);
        String cutoffIso = cutoff.toString();
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/application")
                .queryParam("application_type", "eq.PROFESSIONAL_PRACTICE")
                .queryParam("is_approved_by_ppa", "is.null")
                .queryParam("created_at", "lt." + cutoffIso)
                .queryParam("select", "application_id,opportunity(title),student(university_id)")
                .queryParam("limit", "500")
                .build(false)
                .encode()
                .toUriString();

        Optional<JsonNode> opt = fetchArray(url);
        List<StalePpaReminderRow> out = new ArrayList<>();
        opt.ifPresent(arr -> {
            if (!arr.isArray()) {
                return;
            }
            for (JsonNode node : arr) {
                Integer aid = intValue(node, "application_id");
                if (aid == null) {
                    continue;
                }
                Integer uni = null;
                JsonNode student = node.get("student");
                if (student != null && !student.isNull()) {
                    if (student.isArray() && student.size() > 0) {
                        uni = intValue(student.get(0), "university_id");
                    } else if (student.isObject()) {
                        uni = intValue(student, "university_id");
                    }
                }
                if (uni == null) {
                    continue;
                }
                String title = "";
                JsonNode opp = node.get("opportunity");
                if (opp != null && !opp.isNull()) {
                    if (opp.isArray() && opp.size() > 0) {
                        String t = textValue(opp.get(0), "title");
                        title = t != null ? t : "";
                    } else if (opp.isObject()) {
                        String t = textValue(opp, "title");
                        title = t != null ? t : "";
                    }
                }
                out.add(new StalePpaReminderRow(aid, uni, title));
            }
        });
        return out;
    }

    public Optional<ApplicationResponse> patchApprovalByPpa(int applicationId, int universityId, boolean approved) {
        String verifyUrl = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/application")
                .queryParam("application_id", "eq." + applicationId)
                .queryParam("student.university_id", "eq." + universityId)
                .queryParam("application_type", "eq.PROFESSIONAL_PRACTICE")
                .queryParam("select", APPLICATION_COMPANY_EMBEDS)
                .queryParam("limit", "1")
                .build(false)
                .encode()
                .toUriString();
        Optional<JsonNode> verified = fetchArray(verifyUrl).flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
        if (verified.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> patch = new LinkedHashMap<>();
        patch.put("is_approved_by_ppa", approved);
        return patchApplicationReturning(applicationId, patch);
    }

    public Optional<ApplicationResponse> patchApprovalByCompany(int applicationId, int companyId, boolean approved) {
        String verifyUrl = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/application")
                .queryParam("application_id", "eq." + applicationId)
                .queryParam("company_id", "eq." + companyId)
                .queryParam("select", APPLICATION_COMPANY_EMBEDS)
                .queryParam("limit", "1")
                .build(false)
                .encode()
                .toUriString();
        Optional<JsonNode> verified = fetchArray(verifyUrl).flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
        if (verified.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> patch = new LinkedHashMap<>();
        patch.put("is_approved_by_company", approved);
        return patchApplicationReturning(applicationId, patch);
    }

    private Optional<ApplicationResponse> patchApplicationReturning(int applicationId, Map<String, Object> updates) {
        try {
            String url = supabaseUrl + "/rest/v1/application?application_id=eq." + applicationId;
            HttpHeaders headers = createServiceHeaders();
            headers.set("Prefer", "return=representation");
            String json = objectMapper.writeValueAsString(updates);
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(json, headers),
                    String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                return Optional.empty();
            }
            String body = response.getBody();
            if (body != null && !body.isBlank()) {
                JsonNode root = objectMapper.readTree(body);
                if (root.isArray() && root.size() > 0) {
                    return Optional.of(enrichCompanyApplicantProfile(mapToResponse(root.get(0))));
                }
                if (root.isObject()) {
                    return Optional.of(enrichCompanyApplicantProfile(mapToResponse(root)));
                }
            }
            return reloadApplication(applicationId);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<ApplicationResponse> reloadApplication(int applicationId) {
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/application")
                .queryParam("application_id", "eq." + applicationId)
                .queryParam("select", APPLICATION_COMPANY_EMBEDS)
                .queryParam("limit", "1")
                .build(false)
                .encode()
                .toUriString();
        return fetchArray(url).flatMap(arr ->
                arr.isArray() && arr.size() > 0
                        ? Optional.of(enrichCompanyApplicantProfile(mapToResponse(arr.get(0))))
                        : Optional.empty());
    }
}
