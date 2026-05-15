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
    private static final String DEPARTMENT_TABLE = "department";
    private static final String STUDENT_TABLE = "student";
    private static final String OPPORTUNITY_TARGET_TABLE = "opportunitytarget";

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
                + "?select=university_id,name,email,location,description,website,founded,specialties,number_of_employees,logo_url,cover_url"
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
                    text(u, "description"),
                    text(u, "website"),
                    intVal(u, "founded"),
                    text(u, "specialties"),
                    intVal(u, "number_of_employees"),
                    text(u, "logo_url"),
                    text(u, "cover_url"),
                    true /* isActive placeholder, replaced below */,
                    true /* canDelete placeholder, replaced below */,
                    0    /* departmentCount placeholder */,
                    0    /* studentCount placeholder */
            ));
        }
        Map<Integer, Boolean> activeByUniversityId = fetchAdminActiveByUniversityIds(universityIds);
        Map<Integer, Integer> deptCounts = countByUniversityId(DEPARTMENT_TABLE, universityIds);
        Map<Integer, Integer> studentCounts = countByUniversityId(STUDENT_TABLE, universityIds);
        List<AdminUniversityResponse> merged = new ArrayList<>(rows.size());
        for (AdminUniversityResponse r : rows) {
            boolean active = activeByUniversityId.getOrDefault(r.universityId(), true);
            int deptCount = deptCounts.getOrDefault(r.universityId(), 0);
            int studentCount = studentCounts.getOrDefault(r.universityId(), 0);
            boolean canDelete = deptCount == 0 && studentCount == 0;
            merged.add(new AdminUniversityResponse(
                    r.universityId(), r.name(), r.email(), r.location(), r.description(),
                    r.website(), r.founded(), r.specialties(), r.numberOfEmployees(),
                    r.logoUrl(), r.coverUrl(),
                    active, canDelete, deptCount, studentCount));
        }
        return merged;
    }

    /**
     * Returns counts of rows in {@code table} grouped by {@code university_id} for the given ids.
     * Used to populate {@code departmentCount}/{@code studentCount} on the list view and to
     * gate hard-delete (see {@link #countDependents}).
     */
    private Map<Integer, Integer> countByUniversityId(String table, List<Integer> universityIds) {
        Map<Integer, Integer> result = new HashMap<>();
        if (universityIds == null || universityIds.isEmpty()) {
            return result;
        }
        String idList = universityIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/" + table
                + "?university_id=in.(" + idList + ")"
                + "&select=university_id";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray()) {
            return result;
        }
        for (JsonNode row : arr.get()) {
            Integer uid = intVal(row, "university_id");
            if (uid == null) continue;
            result.merge(uid, 1, Integer::sum);
        }
        return result;
    }

    /** Returns {departmentCount, studentCount} for the given university. Used at delete time. */
    public int[] countDependents(int universityId) {
        Map<Integer, Integer> dept = countByUniversityId(DEPARTMENT_TABLE, List.of(universityId));
        Map<Integer, Integer> student = countByUniversityId(STUDENT_TABLE, List.of(universityId));
        return new int[] {
                dept.getOrDefault(universityId, 0),
                student.getOrDefault(universityId, 0)
        };
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
                + "&select=university_id,name,email,location,description,website,founded,specialties,number_of_employees,logo_url,cover_url"
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
        int[] deps = countDependents(id);
        int deptCount = deps[0];
        int studentCount = deps[1];
        boolean canDelete = deptCount == 0 && studentCount == 0;
        return Optional.of(new AdminUniversityResponse(
                id,
                text(u, "name"),
                text(u, "email"),
                text(u, "location"),
                text(u, "description"),
                text(u, "website"),
                intVal(u, "founded"),
                text(u, "specialties"),
                intVal(u, "number_of_employees"),
                text(u, "logo_url"),
                text(u, "cover_url"),
                active,
                canDelete,
                deptCount,
                studentCount
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
        if (req.description() != null && !req.description().isBlank()) row.put("description", req.description().trim());
        if (req.website() != null && !req.website().isBlank()) row.put("website", req.website().trim());
        if (req.founded() != null) row.put("founded", req.founded());
        if (req.specialties() != null && !req.specialties().isBlank()) row.put("specialties", req.specialties().trim());
        if (req.numberOfEmployees() != null) row.put("number_of_employees", req.numberOfEmployees());
        if (req.logoUrl() != null && !req.logoUrl().isBlank()) row.put("logo_url", req.logoUrl().trim());
        if (req.coverUrl() != null && !req.coverUrl().isBlank()) row.put("cover_url", req.coverUrl().trim());

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
        row.put("description", req.description() == null || req.description().isBlank() ? null : req.description().trim());
        row.put("website", req.website() == null || req.website().isBlank() ? null : req.website().trim());
        row.put("founded", req.founded());
        row.put("specialties", req.specialties() == null || req.specialties().isBlank() ? null : req.specialties().trim());
        row.put("number_of_employees", req.numberOfEmployees());
        // Tri-state semantics for image URLs (mirrors SystemAdminCompanyRepository):
        //   - field absent / null  → "no change", column not touched
        //   - field is empty string → "clear", column set to NULL
        //   - field is a non-blank string → "set", column updated
        if (req.logoUrl() != null) {
            String trimmed = req.logoUrl().trim();
            row.put("logo_url", trimmed.isEmpty() ? null : trimmed);
        }
        if (req.coverUrl() != null) {
            String trimmed = req.coverUrl().trim();
            row.put("cover_url", trimmed.isEmpty() ? null : trimmed);
        }

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

    /* ---------- DELETE ---------- */

    /**
     * Hard-delete: removes the UNIVERSITY_ADMIN useraccount, the Supabase auth user, cleans
     * up stale opportunitytarget rows, then deletes the university row. The caller (service)
     * must have already confirmed there are no department/student dependents.
     */
    public void deleteUniversity(int universityId) {
        String authUserId = findUniversityAuthUserId(universityId);
        deleteUniversityUserAccountRows(universityId);
        if (authUserId != null) {
            deleteAuthUserStrict(authUserId);
        }
        deleteOpportunityTargetRows(universityId);
        deleteUniversityRow(universityId);
    }

    /**
     * Resolves the Supabase auth user UUID for a university's admin by looking up the
     * UNIVERSITY_ADMIN useraccount email and querying the Supabase Auth Admin API.
     */
    private String findUniversityAuthUserId(int universityId) {
        String url = supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE
                + "?role=eq.UNIVERSITY_ADMIN&linked_entity_id=eq." + universityId
                + "&select=email&limit=1";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray() || arr.get().isEmpty()) {
            return null;
        }
        JsonNode row = arr.get().get(0);
        String email = text(row, "email");
        if (email == null || email.isBlank()) {
            return null;
        }
        return findAuthUserIdByEmail(email);
    }

    /** Calls Supabase's Auth Admin API to find an auth user UUID by email. URL-encodes to handle '+' aliases. */
    private String findAuthUserIdByEmail(String email) {
        if (serviceRoleKey == null || serviceRoleKey.isBlank()) {
            return null;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", serviceRoleKey);
            headers.set("Authorization", "Bearer " + serviceRoleKey);
            String encoded = java.net.URLEncoder.encode(email, StandardCharsets.UTF_8);
            ResponseEntity<String> resp = restTemplate.exchange(
                    supabaseUrl + "/auth/v1/admin/users?email=" + encoded,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                return null;
            }
            JsonNode root = objectMapper.readTree(resp.getBody());
            JsonNode users = root.get("users");
            if (users == null || !users.isArray() || users.isEmpty()) {
                return null;
            }
            JsonNode first = users.get(0);
            JsonNode idNode = first.get("id");
            if (idNode == null || idNode.isNull()) {
                return null;
            }
            String id = idNode.asText();
            return (id == null || id.isBlank()) ? null : id;
        } catch (Exception e) {
            log.warn("findAuthUserIdByEmail failed for {}: {}", email, e.getMessage());
            return null;
        }
    }

    private void deleteUniversityUserAccountRows(int universityId) {
        try {
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE
                            + "?role=eq.UNIVERSITY_ADMIN&linked_entity_id=eq." + universityId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(serviceHeaders()),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            log.error("Delete useraccount for university {} failed: {} {}",
                    universityId, e.getStatusCode(), e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not remove the university's admin account. Please try again.");
        }
    }

    private void deleteAuthUserStrict(String authUserId) {
        if (serviceRoleKey == null || serviceRoleKey.isBlank()) {
            log.warn("Cannot revoke auth user {} without service role key", authUserId);
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
        } catch (HttpStatusCodeException e) {
            // 404 = already gone, treat as success.
            if (e.getStatusCode().value() == 404) {
                log.warn("Auth user {} already gone (404); continuing", authUserId);
                return;
            }
            log.error("Delete auth user {} failed: {} {}",
                    authUserId, e.getStatusCode(), e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not remove the linked auth user. Please try again.");
        }
    }

    /**
     * Removes stale {@code opportunitytarget} rows for this university so the FK on
     * {@code opportunitytarget.university_id} doesn't reject the final university row delete.
     * Safe here because the service has already ensured 0 departments and 0 students.
     */
    private void deleteOpportunityTargetRows(int universityId) {
        try {
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + OPPORTUNITY_TARGET_TABLE
                            + "?university_id=eq." + universityId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(serviceHeaders()),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            log.error("Delete opportunitytarget for university {} failed: {} {}",
                    universityId, e.getStatusCode(), e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not clean up opportunity targets. Please try again.");
        }
    }

    private void deleteUniversityRow(int universityId) {
        try {
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + UNIVERSITY_TABLE + "?university_id=eq." + universityId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(serviceHeaders()),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            log.error("Delete university {} failed: {} {}",
                    universityId, e.getStatusCode(), e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not delete the university. Please try again.");
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
