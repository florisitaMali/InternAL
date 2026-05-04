package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.AdminUniversityCreateRequest;
import com.internaal.dto.AdminUniversityResponse;
import com.internaal.dto.AdminUniversityUpdateRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * SYSTEM_ADMIN-only data access for managing universities.
 * Talks to Supabase via PostgREST (service role) plus the Auth Admin API for
 * inviting / removing the auth user that backs each UNIVERSITY_ADMIN account.
 */
@Repository
public class SystemAdminUniversityRepository {

    private static final Logger log = LoggerFactory.getLogger(SystemAdminUniversityRepository.class);

    private static final String UNIVERSITY_TABLE = "university";
    private static final String USER_ACCOUNT_TABLE = "useraccount";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;
    private final String useraccountPasswordPlaceholder;

    public SystemAdminUniversityRepository(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon.key}") String anonKey,
            @Value("${supabase.service.role.key:}") String serviceRoleKey,
            @Value("${supabase.ppa.useraccount-password-placeholder:__SUPABASE_AUTH__}") String useraccountPasswordPlaceholder) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl;
        this.anonKey = anonKey;
        this.serviceRoleKey = serviceRoleKey;
        String ph = useraccountPasswordPlaceholder == null ? "" : useraccountPasswordPlaceholder.trim();
        this.useraccountPasswordPlaceholder = ph.isEmpty() ? "__SUPABASE_AUTH__" : ph;
    }

    private HttpHeaders serviceHeaders() {
        String key = (serviceRoleKey != null && !serviceRoleKey.isBlank()) ? serviceRoleKey : anonKey;
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    /* ---------- READ ---------- */

    public List<AdminUniversityResponse> listUniversitiesWithAdminActiveFlag() {
        String url = supabaseUrl + "/rest/v1/" + UNIVERSITY_TABLE
                + "?select=university_id,name,email,location,website,founded,specialties,number_of_employees"
                + "&order=name";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray()) {
            return List.of();
        }
        List<AdminUniversityResponse> rows = new ArrayList<>();
        List<Integer> universityIds = new ArrayList<>();
        for (JsonNode u : arr.get()) {
            Integer id = intVal(u, "university_id");
            if (id == null) {
                continue;
            }
            universityIds.add(id);
            rows.add(new AdminUniversityResponse(
                    id,
                    text(u, "name"),
                    text(u, "email"),
                    text(u, "location"),
                    text(u, "website"),
                    intVal(u, "founded"),
                    text(u, "specialties"),
                    intVal(u, "number_of_employees"),
                    true /* placeholder, replaced below */
            ));
        }
        Map<Integer, Boolean> activeByUniversityId = fetchAdminActiveByUniversityIds(universityIds);
        List<AdminUniversityResponse> merged = new ArrayList<>(rows.size());
        for (AdminUniversityResponse r : rows) {
            boolean active = activeByUniversityId.getOrDefault(r.universityId(), true);
            merged.add(new AdminUniversityResponse(
                    r.universityId(), r.name(), r.email(), r.location(), r.website(),
                    r.founded(), r.specialties(), r.numberOfEmployees(), active));
        }
        return merged;
    }

    private Map<Integer, Boolean> fetchAdminActiveByUniversityIds(List<Integer> universityIds) {
        Map<Integer, Boolean> result = new HashMap<>();
        if (universityIds == null || universityIds.isEmpty()) {
            return result;
        }
        String idList = universityIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        // select=* avoids URL-encoded quoted column names which Spring's URI template
        // processing can mangle. We read isActive by exact case in Java below.
        String url = supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE
                + "?role=eq.UNIVERSITY_ADMIN"
                + "&linked_entity_id=in.(" + idList + ")"
                + "&select=*";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray()) {
            return result;
        }
        for (JsonNode row : arr.get()) {
            String linkedRaw = text(row, "linked_entity_id");
            if (linkedRaw == null) {
                continue;
            }
            try {
                int uid = Integer.parseInt(linkedRaw);
                JsonNode flag = row.get("isActive");
                boolean active = flag == null || flag.isNull() || flag.asBoolean(true);
                result.put(uid, active);
            } catch (NumberFormatException ignored) {
                /* skip non-numeric */
            }
        }
        return result;
    }

    public boolean emailExistsInUserAccount(String email) {
        String normalized = normalizeEmail(email);
        if (normalized.isBlank()) {
            return false;
        }
        String url = supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE
                + "?email=eq." + normalized + "&select=user_id&limit=1";
        return fetchArray(url).map(arr -> arr.isArray() && !arr.isEmpty()).orElse(false);
    }

    public Optional<AdminUniversityResponse> findById(int universityId) {
        String url = supabaseUrl + "/rest/v1/" + UNIVERSITY_TABLE
                + "?university_id=eq." + universityId
                + "&select=university_id,name,email,location,website,founded,specialties,number_of_employees"
                + "&limit=1";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray() || arr.get().isEmpty()) {
            return Optional.empty();
        }
        JsonNode u = arr.get().get(0);
        Integer id = intVal(u, "university_id");
        if (id == null) {
            return Optional.empty();
        }
        boolean active = fetchAdminActiveByUniversityIds(List.of(id))
                .getOrDefault(id, true);
        return Optional.of(new AdminUniversityResponse(
                id,
                text(u, "name"),
                text(u, "email"),
                text(u, "location"),
                text(u, "website"),
                intVal(u, "founded"),
                text(u, "specialties"),
                intVal(u, "number_of_employees"),
                active
        ));
    }

    /* ---------- CREATE ---------- */

    /**
     * Sends Supabase Auth invite (creates auth.users row, emails password-link),
     * inserts university + useraccount rows, and returns the new university id.
     * On failure between steps, rolls back the auth user to keep state consistent.
     */
    public AdminUniversityResponse createUniversity(AdminUniversityCreateRequest req) throws Exception {
        String email = normalizeEmail(req.email());
        String authUserId = inviteAuthUser(email);
        Integer newUniversityId = null;
        try {
            newUniversityId = insertUniversityRow(req, email);
            insertUniversityAdminUserAccount(email, newUniversityId);
        } catch (Exception primary) {
            // Rollback in reverse order — best-effort.
            if (newUniversityId != null) {
                safeDeleteUniversity(newUniversityId);
            }
            safeDeleteAuthUser(authUserId);
            throw primary;
        }
        final int createdId = newUniversityId;
        return findById(createdId)
                .orElseThrow(() -> new IllegalStateException("University inserted but could not be re-read: id=" + createdId));
    }

    private String inviteAuthUser(String email) throws Exception {
        if (serviceRoleKey == null || serviceRoleKey.isBlank()) {
            throw new IllegalStateException("SUPABASE_SERVICE_ROLE_KEY is not configured");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", serviceRoleKey);
        headers.set("Authorization", "Bearer " + serviceRoleKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        String json = objectMapper.writeValueAsString(body);

        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(
                    supabaseUrl + "/auth/v1/invite",
                    HttpMethod.POST,
                    new HttpEntity<>(json, headers),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            String responseBody = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("Supabase invite failed: {} {}", e.getStatusCode(), responseBody);
            throw new IllegalStateException(translateInviteError(e.getStatusCode().value(), responseBody));
        }
        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            log.error("Supabase invite returned non-2xx without body: {}", resp.getStatusCode());
            throw new IllegalStateException("Could not send invite email. Please try again.");
        }
        JsonNode root = objectMapper.readTree(resp.getBody());
        JsonNode idNode = root.get("id");
        return idNode != null && !idNode.isNull() ? idNode.asText() : null;
    }

    private String translateInviteError(int status, String body) {
        String code = extractSupabaseErrorCode(body);
        if (status == 429 || "over_email_send_rate_limit".equals(code)) {
            return "Email rate limit reached. Please try again in about an hour.";
        }
        if ("user_already_exists".equals(code) || "email_exists".equals(code)) {
            return "An account with this email already exists.";
        }
        if (status == 422) {
            return "The email address was rejected. Please double-check and try again.";
        }
        return "Could not send invite email. Please try again.";
    }

    private String extractSupabaseErrorCode(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonNode root = objectMapper.readTree(body);
            if (root.has("error_code") && root.get("error_code").isTextual()) {
                return root.get("error_code").asText();
            }
            if (root.has("code") && root.get("code").isTextual()) {
                return root.get("code").asText();
            }
        } catch (Exception ignored) { /* not JSON */ }
        return null;
    }

    private Integer insertUniversityRow(AdminUniversityCreateRequest req, String email) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", req.name() == null ? null : req.name().trim());
        row.put("email", email);
        if (req.location() != null && !req.location().isBlank()) row.put("location", req.location().trim());
        if (req.website() != null && !req.website().isBlank()) row.put("website", req.website().trim());
        if (req.founded() != null) row.put("founded", req.founded());
        if (req.specialties() != null && !req.specialties().isBlank()) row.put("specialties", req.specialties().trim());
        if (req.numberOfEmployees() != null) row.put("number_of_employees", req.numberOfEmployees());

        HttpHeaders headers = serviceHeaders();
        headers.set("Prefer", "return=representation");
        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + UNIVERSITY_TABLE,
                    HttpMethod.POST,
                    new HttpEntity<>(objectMapper.writeValueAsString(row), headers),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            log.error("Insert university failed: {} {}", e.getStatusCode(),
                    e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not save the university. Please try again.");
        }
        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            log.error("Insert university returned non-2xx: {}", resp.getStatusCode());
            throw new IllegalStateException("Could not save the university. Please try again.");
        }
        JsonNode root = objectMapper.readTree(resp.getBody());
        JsonNode first = root.isArray() && !root.isEmpty() ? root.get(0) : null;
        Integer id = intVal(first, "university_id");
        if (id == null) {
            log.error("Insert university returned no university_id; body: {}", resp.getBody());
            throw new IllegalStateException("Could not save the university. Please try again.");
        }
        return id;
    }

    private void insertUniversityAdminUserAccount(String email, int universityId) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("email", email);
        row.put("password", useraccountPasswordPlaceholder);
        row.put("role", "UNIVERSITY_ADMIN");
        row.put("linked_entity_id", universityId);
        row.put("isActive", true);

        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE,
                    HttpMethod.POST,
                    new HttpEntity<>(objectMapper.writeValueAsString(row), serviceHeaders()),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            log.error("Insert useraccount failed: {} {}", e.getStatusCode(),
                    e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not link the new admin to the university. Please try again.");
        }
        if (!resp.getStatusCode().is2xxSuccessful()) {
            log.error("Insert useraccount returned non-2xx: {}", resp.getStatusCode());
            throw new IllegalStateException("Could not link the new admin to the university. Please try again.");
        }
    }

    private void safeDeleteUniversity(int universityId) {
        try {
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + UNIVERSITY_TABLE + "?university_id=eq." + universityId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(serviceHeaders()),
                    String.class
            );
        } catch (Exception e) {
            log.warn("Rollback delete university {} failed: {}", universityId, e.getMessage());
        }
    }

    private void safeDeleteAuthUser(String authUserId) {
        if (authUserId == null || authUserId.isBlank()
                || serviceRoleKey == null || serviceRoleKey.isBlank()) {
            return;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", serviceRoleKey);
            headers.set("Authorization", "Bearer " + serviceRoleKey);
            restTemplate.exchange(
                    supabaseUrl + "/auth/v1/admin/users/" + authUserId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(headers),
                    String.class
            );
        } catch (Exception e) {
            log.warn("Rollback delete auth user {} failed: {}", authUserId, e.getMessage());
        }
    }

    /* ---------- UPDATE ---------- */

    public Optional<AdminUniversityResponse> updateUniversity(int universityId, AdminUniversityUpdateRequest req) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", req.name() == null ? null : req.name().trim());
        row.put("location", req.location() == null || req.location().isBlank() ? null : req.location().trim());
        row.put("website", req.website() == null || req.website().isBlank() ? null : req.website().trim());
        row.put("founded", req.founded());
        row.put("specialties", req.specialties() == null || req.specialties().isBlank() ? null : req.specialties().trim());
        row.put("number_of_employees", req.numberOfEmployees());

        HttpHeaders headers = serviceHeaders();
        headers.set("Prefer", "return=representation");
        ResponseEntity<String> resp = restTemplate.exchange(
                supabaseUrl + "/rest/v1/" + UNIVERSITY_TABLE + "?university_id=eq." + universityId,
                HttpMethod.PATCH,
                new HttpEntity<>(objectMapper.writeValueAsString(row), headers),
                String.class
        );
        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            return Optional.empty();
        }
        JsonNode root = objectMapper.readTree(resp.getBody());
        if (!root.isArray() || root.isEmpty()) {
            return Optional.empty();
        }
        return findById(universityId);
    }

    /* ---------- STATUS / DEACTIVATION CASCADE ---------- */

    /**
     * Flips isActive on the UNIVERSITY_ADMIN useraccount linked to this university.
     * The Postgres AFTER UPDATE trigger on useraccount fans this out to:
     *   - useraccount rows for PPAs whose department belongs to this university
     *   - student.canApplyForPP for students of this university
     */
    public boolean setUniversityActive(int universityId, boolean isActive) {
        return updateUserAccounts(
                "?role=eq.UNIVERSITY_ADMIN&linked_entity_id=eq." + universityId,
                isActive);
    }

    private boolean updateUserAccounts(String filter, boolean isActive) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("isActive", isActive);
            HttpHeaders headers = serviceHeaders();
            // ask PostgREST to return the updated rows so we can detect zero-row updates
            headers.set("Prefer", "return=representation");
            ResponseEntity<String> resp = restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE + filter,
                    HttpMethod.PATCH,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                    String.class
            );
            if (!resp.getStatusCode().is2xxSuccessful()) {
                log.error("updateUserAccounts({}) returned non-2xx: {}", filter, resp.getStatusCode());
                return false;
            }
            String responseBody = resp.getBody();
            if (responseBody == null || responseBody.isBlank()) {
                log.error("updateUserAccounts({}) matched zero rows", filter);
                return false;
            }
            JsonNode root = objectMapper.readTree(responseBody);
            if (!root.isArray() || root.isEmpty()) {
                log.error("updateUserAccounts({}) matched zero rows", filter);
                return false;
            }
            return true;
        } catch (Exception e) {
            log.error("updateUserAccounts({}) failed: {}", filter, e.getMessage());
            return false;
        }
    }

    /* ---------- INTERNAL UTILS ---------- */

    private Optional<JsonNode> fetchArray(String url) {
        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(serviceHeaders()), String.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                return Optional.of(objectMapper.readTree(resp.getBody()));
            }
        } catch (Exception ignored) {
            /* empty */
        }
        return Optional.empty();
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String text(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        return n.get(field).asText();
    }

    private static Integer intVal(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        JsonNode v = n.get(field);
        return v.isNumber() ? v.asInt() : null;
    }
}
