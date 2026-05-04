package com.internaal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Supabase Auth admin endpoints (service role), e.g. invite-by-email for new PPAs,
 * and keeping {@code auth.users} in sync when a PPA is edited or removed in the app DB.
 */
@Service
public class SupabaseAuthAdminService {

    private static final Logger log = LoggerFactory.getLogger(SupabaseAuthAdminService.class);

    private static final int ADMIN_USERS_PAGE_SIZE = 200;
    private static final int ADMIN_USERS_MAX_PAGES = 100;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String serviceRoleKey;
    private final boolean inviteOnPpaCreate;
    /** e.g. https://app.example.com — invite emails redirect here + /auth/set-password */
    private final String frontendBaseUrl;

    public SupabaseAuthAdminService(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.service.role.key:}") String serviceRoleKey,
            @Value("${supabase.invite.on-ppa-create:true}") boolean inviteOnPpaCreate,
            @Value("${app.frontend.url:}") String frontendBaseUrl) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl == null ? "" : supabaseUrl.replaceAll("/+$", "");
        this.serviceRoleKey = serviceRoleKey == null ? "" : serviceRoleKey.trim();
        this.inviteOnPpaCreate = inviteOnPpaCreate;
        String fe = frontendBaseUrl == null ? "" : frontendBaseUrl.trim().replaceAll("/+$", "");
        this.frontendBaseUrl = fe;
    }

    /** For JSON request bodies (invite, PUT user). */
    private HttpHeaders adminAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", serviceRoleKey);
        headers.set("Authorization", "Bearer " + serviceRoleKey);
        return headers;
    }

    /**
     * For GET/DELETE admin calls. Avoid {@code Content-Type: application/json} with no body — some gateways reject that
     * and the delete never reaches GoTrue, leaving orphan {@code auth.users} rows.
     */
    private HttpHeaders adminBearerHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", serviceRoleKey);
        headers.set("Authorization", "Bearer " + serviceRoleKey);
        return headers;
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private Optional<String> findAuthUserIdByEmail(String normalizedEmail) {
        if (supabaseUrl.isBlank() || serviceRoleKey.isBlank() || normalizedEmail.isBlank()) {
            return Optional.empty();
        }
        for (int page = 1; page <= ADMIN_USERS_MAX_PAGES; page++) {
            try {
                String url = supabaseUrl + "/auth/v1/admin/users?page=" + page + "&per_page=" + ADMIN_USERS_PAGE_SIZE;
                ResponseEntity<String> response = restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        new HttpEntity<>(adminBearerHeaders()),
                        String.class);
                if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                    break;
                }
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode users = root.get("users");
                if (users == null || !users.isArray() || users.isEmpty()) {
                    break;
                }
                for (JsonNode u : users) {
                    String em = u.has("email") && !u.get("email").isNull() ? u.get("email").asText("") : "";
                    if (normalizedEmail.equalsIgnoreCase(em.trim())) {
                        String id = u.has("id") ? u.get("id").asText("") : "";
                        if (!id.isBlank()) {
                            return Optional.of(id);
                        }
                    }
                }
                if (users.size() < ADMIN_USERS_PAGE_SIZE) {
                    break;
                }
            } catch (Exception e) {
                log.warn("Supabase admin list users failed (page {}): {}", page, e.getMessage());
                break;
            }
        }
        return Optional.empty();
    }

    private Optional<JsonNode> getAuthUser(String userId) {
        if (supabaseUrl.isBlank() || serviceRoleKey.isBlank() || userId == null || userId.isBlank()) {
            return Optional.empty();
        }
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    supabaseUrl + "/auth/v1/admin/users/" + userId,
                    HttpMethod.GET,
                    new HttpEntity<>(adminBearerHeaders()),
                    String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return Optional.of(objectMapper.readTree(response.getBody()));
            }
        } catch (RestClientResponseException e) {
            if (!e.getStatusCode().is4xxClientError()) {
                log.warn("Supabase admin get user {}: {} — {}", userId, e.getStatusCode(), e.getResponseBodyAsString());
            }
        } catch (Exception e) {
            log.warn("Supabase admin get user {}: {}", userId, e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * After a PPA row is updated in PostgREST, update the matching {@code auth.users} row (email + user_metadata).
     *
     * @param previousEmail email before the edit (used to locate the auth user if {@code preferredAuthUserId} is empty)
     * @param newEmail      email after the edit
     * @param fullName      display name to store in {@code user_metadata.full_name}
     * @param preferredAuthUserId optional Supabase Auth UUID from {@code useraccount.supabase_user_id}
     */
    public void syncPpaAuthUser(
            String previousEmail,
            String newEmail,
            String fullName,
            Optional<String> preferredAuthUserId) {
        if (supabaseUrl.isBlank() || serviceRoleKey.isBlank()) {
            return;
        }
        String oldNorm = normalizeEmail(previousEmail);
        String newNorm = normalizeEmail(newEmail);
        if (newNorm.isBlank()) {
            return;
        }
        Optional<String> userIdOpt = preferredAuthUserId.filter(id -> id != null && !id.isBlank());
        if (userIdOpt.isEmpty() && !oldNorm.isBlank()) {
            userIdOpt = findAuthUserIdByEmail(oldNorm);
        }
        if (userIdOpt.isEmpty()) {
            log.info("Supabase auth sync PPA: no auth user for previousEmail={}", oldNorm);
            return;
        }
        String userId = userIdOpt.get();
        Optional<JsonNode> currentOpt = getAuthUser(userId);
        ObjectNode meta;
        if (currentOpt.isPresent() && currentOpt.get().has("user_metadata")
                && currentOpt.get().get("user_metadata").isObject()) {
            meta = (ObjectNode) currentOpt.get().get("user_metadata").deepCopy();
        } else {
            meta = objectMapper.createObjectNode();
        }
        if (fullName != null && !fullName.isBlank()) {
            meta.put("full_name", fullName.trim());
        }
        meta.put("internaal_app_role", "PPA");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("email", newNorm);
        body.set("user_metadata", meta);

        try {
            String json = objectMapper.writeValueAsString(body);
            ResponseEntity<String> response = restTemplate.exchange(
                    supabaseUrl + "/auth/v1/admin/users/" + userId,
                    HttpMethod.PUT,
                    new HttpEntity<>(json, adminAuthHeaders()),
                    String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.warn("Supabase auth update PPA user {} non-success: {}", userId, response.getStatusCode());
            } else {
                log.info("Supabase auth updated PPA user {}", userId);
            }
        } catch (RestClientResponseException e) {
            log.warn("Supabase auth update PPA user {} failed: {} — {}", userId, e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.warn("Supabase auth update PPA user {} failed: {}", userId, e.getMessage());
        }
    }

    /**
     * Removes the Auth user from {@code auth.users} (call after app rows are deleted).
     *
     * @param email used to locate the user when {@code preferredAuthUserId} is empty
     */
    public void deleteAuthUserIfExists(String email, Optional<String> preferredAuthUserId) {
        if (supabaseUrl.isBlank() || serviceRoleKey.isBlank()) {
            log.warn("Supabase auth delete skipped: supabase.url or supabase.service.role.key is empty — orphan auth users possible");
            return;
        }
        String normEmail = normalizeEmail(email);
        Optional<String> userIdOpt = preferredAuthUserId.filter(id -> id != null && !id.isBlank());
        if (userIdOpt.isEmpty()) {
            if (normEmail.isBlank()) {
                log.warn("Supabase auth delete skipped: no email and no auth user id");
                return;
            }
            userIdOpt = findAuthUserIdByEmail(normEmail);
        }
        if (userIdOpt.isEmpty()) {
            log.warn(
                    "Supabase auth delete: could not resolve auth user id for email={} (check service role key, or delete manually in Dashboard → Authentication → Users, or SQL: delete from auth.users where email = …)",
                    normEmail);
            return;
        }
        String userId = userIdOpt.get();
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    supabaseUrl + "/auth/v1/admin/users/" + userId,
                    HttpMethod.DELETE,
                    new HttpEntity<>(adminBearerHeaders()),
                    String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Supabase auth deleted user {} ({})", userId, normEmail);
            } else {
                log.warn("Supabase auth delete {} non-success: {}", userId, response.getStatusCode());
            }
        } catch (RestClientResponseException e) {
            log.warn(
                    "Supabase auth delete {} failed: {} — {} (Dashboard: Authentication → Users, or SQL editor as postgres)",
                    userId,
                    e.getStatusCode(),
                    e.getResponseBodyAsString());
        } catch (Exception e) {
            log.warn("Supabase auth delete {} failed: {}", userId, e.getMessage());
        }
    }

    /**
     * Sends Supabase "invite user" email so the PPA lands on the app to create a password.
     * The link exchanges a one-time token (Supabase requirement); afterward the PPA signs in with email + password.
     * No-op if disabled, URL/key missing, or email blank. Logs and swallows common duplicates.
     */
    public void invitePpaIfConfigured(String email, String fullName) {
        if (!inviteOnPpaCreate || supabaseUrl.isBlank() || serviceRoleKey.isBlank()) {
            if (inviteOnPpaCreate && serviceRoleKey.isBlank()) {
                log.warn("supabase.invite.on-ppa-create is true but supabase.service.role.key is empty; skip invite");
            }
            return;
        }
        String normalized = normalizeEmail(email);
        if (normalized.isBlank()) {
            return;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", serviceRoleKey);
            headers.set("Authorization", "Bearer " + serviceRoleKey);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("email", normalized);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("invite_password_completed", false);
            data.put("internaal_app_role", "PPA");
            if (fullName != null && !fullName.isBlank()) {
                data.put("full_name", fullName.trim());
            }
            body.put("data", data);
            String redirectTo = null;
            if (!frontendBaseUrl.isBlank()) {
                redirectTo = frontendBaseUrl + "/auth/set-password";
                body.put("redirect_to", redirectTo);
            }
            if (redirectTo != null) {
                log.info("Supabase PPA invite for {} redirect_to={}", normalized, redirectTo);
            }
            String json = objectMapper.writeValueAsString(body);
            ResponseEntity<String> response = restTemplate.exchange(
                    supabaseUrl + "/auth/v1/invite",
                    HttpMethod.POST,
                    new HttpEntity<>(json, headers),
                    String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.warn("Supabase invite non-success for {}: {}", normalized, response.getStatusCode());
            }
        } catch (RestClientResponseException e) {
            String raw = e.getResponseBodyAsString();
            if (raw != null && (raw.contains("already been registered") || raw.contains("already registered")
                    || raw.contains("User already registered"))) {
                log.info("Supabase invite skipped (user already exists): {}", normalized);
                return;
            }
            log.warn("Supabase invite failed for {}: {} — {}", normalized, e.getStatusCode(), raw);
        } catch (Exception e) {
            log.warn("Supabase invite failed for {}: {}", normalized, e.getMessage());
        }
    }
}
