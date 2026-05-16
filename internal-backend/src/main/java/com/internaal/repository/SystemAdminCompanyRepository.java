package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.AdminCompanyCreateRequest;
import com.internaal.dto.AdminCompanyResponse;
import com.internaal.dto.AdminCompanyUpdateRequest;
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
 * SYSTEM_ADMIN-only data access for managing company accounts.
 * Mirrors {@link SystemAdminUniversityRepository}, with three deltas:
 *   - the company table has no email column; email lives on the linked useraccount row,
 *   - dependent counts (opportunity, application) are computed for the canDelete flag,
 *   - companies have no child accounts, so deactivation does not need a cascade trigger.
 */
@Repository
public class SystemAdminCompanyRepository {

    private static final Logger log = LoggerFactory.getLogger(SystemAdminCompanyRepository.class);

    private static final String COMPANY_TABLE = "company";
    private static final String USER_ACCOUNT_TABLE = "useraccount";
    private static final String OPPORTUNITY_TABLE = "opportunity";
    private static final String APPLICATION_TABLE = "application";
    private static final String COMPANY_FEEDBACK_TABLE = "companyfeedback";

    private static final String COMPANY_SELECT =
            "company_id,name,industry,location,description,website,founded_year,employee_count,specialties,logo_url,cover_url";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;
    private final String useraccountPasswordPlaceholder;

    public SystemAdminCompanyRepository(
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

    /**
     * One list endpoint that returns everything the admin tab needs:
     * core company columns + email/isActive (from useraccount) + opportunity/application counts.
     * Counts run in batch (one query each) and are joined in Java to avoid N+1.
     */
    public List<AdminCompanyResponse> listCompaniesWithAccountAndDeps() {
        String url = supabaseUrl + "/rest/v1/" + COMPANY_TABLE
                + "?select=" + COMPANY_SELECT
                + "&order=name";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray()) {
            return List.of();
        }
        List<Integer> companyIds = new ArrayList<>();
        List<JsonNode> rows = new ArrayList<>();
        for (JsonNode c : arr.get()) {
            Integer id = intVal(c, "company_id");
            if (id == null) continue;
            companyIds.add(id);
            rows.add(c);
        }
        Map<Integer, CompanyAccount> accountByCompanyId = fetchAccountByCompanyIds(companyIds);
        Map<Integer, Integer> opportunityCounts = countByCompanyId(OPPORTUNITY_TABLE, "opportunity_id", companyIds);
        Map<Integer, Integer> applicationCounts = countByCompanyId(APPLICATION_TABLE, "application_id", companyIds);
        Map<Integer, Integer> feedbackCounts = countByCompanyId(COMPANY_FEEDBACK_TABLE, "feedback_id", companyIds);

        List<AdminCompanyResponse> out = new ArrayList<>(rows.size());
        for (JsonNode c : rows) {
            int id = intVal(c, "company_id");
            CompanyAccount acct = accountByCompanyId.getOrDefault(id, new CompanyAccount(null, true));
            int oppCount = opportunityCounts.getOrDefault(id, 0);
            int appCount = applicationCounts.getOrDefault(id, 0);
            int fbCount = feedbackCounts.getOrDefault(id, 0);
            out.add(new AdminCompanyResponse(
                    id,
                    text(c, "name"),
                    acct.email,
                    text(c, "industry"),
                    text(c, "location"),
                    text(c, "description"),
                    text(c, "website"),
                    intVal(c, "founded_year"),
                    intVal(c, "employee_count"),
                    text(c, "specialties"),
                    text(c, "logo_url"),
                    text(c, "cover_url"),
                    acct.isActive,
                    oppCount + appCount + fbCount == 0,
                    oppCount,
                    appCount,
                    fbCount
            ));
        }
        return out;
    }

    public Optional<AdminCompanyResponse> findById(int companyId) {
        String url = supabaseUrl + "/rest/v1/" + COMPANY_TABLE
                + "?company_id=eq." + companyId
                + "&select=" + COMPANY_SELECT
                + "&limit=1";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray() || arr.get().isEmpty()) {
            return Optional.empty();
        }
        JsonNode c = arr.get().get(0);
        Integer id = intVal(c, "company_id");
        if (id == null) {
            return Optional.empty();
        }
        Map<Integer, CompanyAccount> accountByCompanyId = fetchAccountByCompanyIds(List.of(id));
        CompanyAccount acct = accountByCompanyId.getOrDefault(id, new CompanyAccount(null, true));
        Map<Integer, Integer> opp = countByCompanyId(OPPORTUNITY_TABLE, "opportunity_id", List.of(id));
        Map<Integer, Integer> app = countByCompanyId(APPLICATION_TABLE, "application_id", List.of(id));
        Map<Integer, Integer> fb = countByCompanyId(COMPANY_FEEDBACK_TABLE, "feedback_id", List.of(id));
        int oppCount = opp.getOrDefault(id, 0);
        int appCount = app.getOrDefault(id, 0);
        int fbCount = fb.getOrDefault(id, 0);
        return Optional.of(new AdminCompanyResponse(
                id,
                text(c, "name"),
                acct.email,
                text(c, "industry"),
                text(c, "location"),
                text(c, "description"),
                text(c, "website"),
                intVal(c, "founded_year"),
                intVal(c, "employee_count"),
                text(c, "specialties"),
                text(c, "logo_url"),
                text(c, "cover_url"),
                acct.isActive,
                oppCount + appCount + fbCount == 0,
                oppCount,
                appCount,
                fbCount
        ));
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

    /** Returns counts of opportunities, applications, and feedback for the given company. Used at delete time. */
    public int[] countDependents(int companyId) {
        Map<Integer, Integer> opp = countByCompanyId(OPPORTUNITY_TABLE, "opportunity_id", List.of(companyId));
        Map<Integer, Integer> app = countByCompanyId(APPLICATION_TABLE, "application_id", List.of(companyId));
        Map<Integer, Integer> fb = countByCompanyId(COMPANY_FEEDBACK_TABLE, "feedback_id", List.of(companyId));
        return new int[] {
                opp.getOrDefault(companyId, 0),
                app.getOrDefault(companyId, 0),
                fb.getOrDefault(companyId, 0)
        };
    }

    private record CompanyAccount(String email, boolean isActive) { }

    private Map<Integer, CompanyAccount> fetchAccountByCompanyIds(List<Integer> companyIds) {
        Map<Integer, CompanyAccount> result = new HashMap<>();
        if (companyIds == null || companyIds.isEmpty()) {
            return result;
        }
        String idList = companyIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE
                + "?role=eq.COMPANY"
                + "&linked_entity_id=in.(" + idList + ")"
                + "&select=*";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray()) {
            return result;
        }
        for (JsonNode row : arr.get()) {
            String linkedRaw = text(row, "linked_entity_id");
            if (linkedRaw == null) continue;
            try {
                int cid = Integer.parseInt(linkedRaw);
                JsonNode flag = row.get("isActive");
                boolean active = flag == null || flag.isNull() || flag.asBoolean(true);
                String email = text(row, "email");
                result.put(cid, new CompanyAccount(email, active));
            } catch (NumberFormatException ignored) {
                /* skip non-numeric */
            }
        }
        return result;
    }

    private Map<Integer, Integer> countByCompanyId(String table, String idColumn, List<Integer> companyIds) {
        Map<Integer, Integer> result = new HashMap<>();
        if (companyIds == null || companyIds.isEmpty()) {
            return result;
        }
        String idList = companyIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = supabaseUrl + "/rest/v1/" + table
                + "?company_id=in.(" + idList + ")"
                + "&select=company_id";
        Optional<JsonNode> arr = fetchArray(url);
        if (arr.isEmpty() || !arr.get().isArray()) {
            return result;
        }
        for (JsonNode row : arr.get()) {
            Integer cid = intVal(row, "company_id");
            if (cid == null) continue;
            result.merge(cid, 1, Integer::sum);
        }
        return result;
    }

    /* ---------- CREATE ---------- */

    /**
     * Sends Supabase Auth invite, inserts company + COMPANY useraccount rows, returns the new row.
     * Best-effort rollback on partial failure mirrors {@link SystemAdminUniversityRepository#createUniversity}.
     */
    public AdminCompanyResponse createCompany(AdminCompanyCreateRequest req) throws Exception {
        String email = normalizeEmail(req.email());
        String authUserId = inviteAuthUser(email);
        Integer newCompanyId = null;
        try {
            newCompanyId = insertCompanyRow(req, email);
            insertCompanyUserAccount(email, newCompanyId);
        } catch (Exception primary) {
            if (newCompanyId != null) {
                safeDeleteCompany(newCompanyId);
            }
            safeDeleteAuthUser(authUserId);
            throw primary;
        }
        final int createdId = newCompanyId;
        return findById(createdId)
                .orElseThrow(() -> new IllegalStateException("Company inserted but could not be re-read: id=" + createdId));
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

    private Integer insertCompanyRow(AdminCompanyCreateRequest req, String email) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", req.name() == null ? null : req.name().trim());
        row.put("email", email);
        // company.password is NOT NULL with no default; the real auth lives in Supabase, so we
        // store the same placeholder the useraccount table uses.
        row.put("password", useraccountPasswordPlaceholder);
        if (req.industry() != null && !req.industry().isBlank()) row.put("industry", req.industry().trim());
        if (req.location() != null && !req.location().isBlank()) row.put("location", req.location().trim());
        if (req.description() != null && !req.description().isBlank()) row.put("description", req.description().trim());
        if (req.website() != null && !req.website().isBlank()) row.put("website", req.website().trim());
        if (req.foundedYear() != null) row.put("founded_year", req.foundedYear());
        if (req.employeeCount() != null) row.put("employee_count", req.employeeCount());
        if (req.specialties() != null && !req.specialties().isBlank()) row.put("specialties", req.specialties().trim());
        if (req.logoUrl() != null && !req.logoUrl().isBlank()) row.put("logo_url", req.logoUrl().trim());
        if (req.coverUrl() != null && !req.coverUrl().isBlank()) row.put("cover_url", req.coverUrl().trim());

        HttpHeaders headers = serviceHeaders();
        headers.set("Prefer", "return=representation");
        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + COMPANY_TABLE,
                    HttpMethod.POST,
                    new HttpEntity<>(objectMapper.writeValueAsString(row), headers),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            log.error("Insert company failed: {} {}", e.getStatusCode(),
                    e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not save the company. Please try again.");
        }
        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            log.error("Insert company returned non-2xx: {}", resp.getStatusCode());
            throw new IllegalStateException("Could not save the company. Please try again.");
        }
        JsonNode root = objectMapper.readTree(resp.getBody());
        JsonNode first = root.isArray() && !root.isEmpty() ? root.get(0) : null;
        Integer id = intVal(first, "company_id");
        if (id == null) {
            log.error("Insert company returned no company_id; body: {}", resp.getBody());
            throw new IllegalStateException("Could not save the company. Please try again.");
        }
        return id;
    }

    private void insertCompanyUserAccount(String email, int companyId) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("email", email);
        row.put("password", useraccountPasswordPlaceholder);
        row.put("role", "COMPANY");
        row.put("linked_entity_id", companyId);
        row.put("isActive", true);
        // The supabase_user_id column is intentionally NOT written here.
        // It only exists in databases where alter-useraccount-supabase-user-id.sql
        // has been applied; deleteCompany resolves the auth UUID via the Supabase
        // Auth Admin API by email instead, which works in both cases.

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
            throw new IllegalStateException("Could not link the new account to the company. Please try again.");
        }
        if (!resp.getStatusCode().is2xxSuccessful()) {
            log.error("Insert useraccount returned non-2xx: {}", resp.getStatusCode());
            throw new IllegalStateException("Could not link the new account to the company. Please try again.");
        }
    }

    private void safeDeleteCompany(int companyId) {
        try {
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + COMPANY_TABLE + "?company_id=eq." + companyId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(serviceHeaders()),
                    String.class
            );
        } catch (Exception e) {
            log.warn("Rollback delete company {} failed: {}", companyId, e.getMessage());
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

    public Optional<AdminCompanyResponse> updateCompany(int companyId, AdminCompanyUpdateRequest req) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", req.name() == null ? null : req.name().trim());
        row.put("industry", req.industry() == null || req.industry().isBlank() ? null : req.industry().trim());
        row.put("location", req.location() == null || req.location().isBlank() ? null : req.location().trim());
        row.put("description", req.description() == null || req.description().isBlank() ? null : req.description().trim());
        row.put("website", req.website() == null || req.website().isBlank() ? null : req.website().trim());
        row.put("founded_year", req.foundedYear());
        row.put("employee_count", req.employeeCount());
        row.put("specialties", req.specialties() == null || req.specialties().isBlank() ? null : req.specialties().trim());
        // Tri-state semantics for image URLs:
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
                supabaseUrl + "/rest/v1/" + COMPANY_TABLE + "?company_id=eq." + companyId,
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
        return findById(companyId);
    }

    /* ---------- STATUS ---------- */

    /**
     * Flips isActive on the COMPANY useraccount linked to this company.
     * Companies have no child accounts, so no cascade is required.
     */
    public boolean setCompanyActive(int companyId, boolean isActive) {
        return updateUserAccounts(
                "?role=eq.COMPANY&linked_entity_id=eq." + companyId,
                isActive);
    }

    private boolean updateUserAccounts(String filter, boolean isActive) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("isActive", isActive);
            HttpHeaders headers = serviceHeaders();
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
     * Hard-delete: removes the COMPANY useraccount, the Supabase auth user, then the company row.
     * The caller (service) must have already confirmed there are no dependents.
     */
    public void deleteCompany(int companyId) {
        String authUserId = findCompanyAuthUserId(companyId);
        deleteCompanyUserAccountRows(companyId);
        if (authUserId != null) {
            deleteAuthUserStrict(authUserId);
        }
        deleteCompanyRow(companyId);
    }

    /**
     * Resolves the Supabase auth user UUID for a company by looking it up via the
     * Supabase Auth Admin API by email. Avoids depending on the optional
     * {@code useraccount.supabase_user_id} column, which only exists where
     * {@code alter-useraccount-supabase-user-id.sql} has been applied.
     */
    private String findCompanyAuthUserId(int companyId) {
        String url = supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE
                + "?role=eq.COMPANY&linked_entity_id=eq." + companyId
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

    private void deleteCompanyUserAccountRows(int companyId) {
        try {
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + USER_ACCOUNT_TABLE
                            + "?role=eq.COMPANY&linked_entity_id=eq." + companyId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(serviceHeaders()),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            log.error("Delete useraccount for company {} failed: {} {}",
                    companyId, e.getStatusCode(), e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not remove the company's account. Please try again.");
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
            log.warn("Delete auth user {} returned {}: {}", authUserId, e.getStatusCode(),
                    e.getResponseBodyAsString(StandardCharsets.UTF_8));
            // Soft fail: useraccount + company rows are gone; an orphan auth user is recoverable manually.
        } catch (Exception e) {
            log.warn("Delete auth user {} failed: {}", authUserId, e.getMessage());
        }
    }

    private void deleteCompanyRow(int companyId) {
        try {
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/" + COMPANY_TABLE + "?company_id=eq." + companyId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(serviceHeaders()),
                    String.class
            );
        } catch (HttpStatusCodeException e) {
            log.error("Delete company {} failed: {} {}", companyId, e.getStatusCode(),
                    e.getResponseBodyAsString(StandardCharsets.UTF_8));
            throw new IllegalStateException("Could not remove the company. Please try again.");
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
