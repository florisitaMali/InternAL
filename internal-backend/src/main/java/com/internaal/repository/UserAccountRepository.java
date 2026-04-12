package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Repository
public class UserAccountRepository {

    private static final Logger log = LoggerFactory.getLogger(UserAccountRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String supabaseAnonKey;
    private final String supabaseServiceRoleKey;

    public UserAccountRepository(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon.key}") String supabaseAnonKey,
            @Value("${supabase.service.role.key:}") String supabaseServiceRoleKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl;
        this.supabaseAnonKey = supabaseAnonKey;
        this.supabaseServiceRoleKey = supabaseServiceRoleKey;
    }

    private boolean serviceRoleConfigured() {
        return StringUtils.hasText(supabaseServiceRoleKey);
    }

    /**
     * Resolves a useraccount by email, using the user's own JWT to satisfy RLS.
     *
     * The Supabase RLS policy on useraccount allows authenticated users to read
     * only their own row (matched by email). So we pass the user's JWT as the
     * Authorization header instead of the anon key.
     *
     * NOTE: To migrate to Supabase user ID resolution later, add a method
     * findBySupabaseUserId(String supabaseUserId, String userJwt) that queries:
     * /rest/v1/useraccount?supabase_user_id=eq.{id}
     */
    public Optional<UserAccount> findByEmail(String email, String userJwt) {
        Objects.requireNonNull(email, "email");
        try {
            Optional<UserAccount> withUserJwt = fetchUseraccountWithUserJwt(email, userJwt);
            if (withUserJwt.isPresent()) {
                return withUserJwt;
            }
            if (serviceRoleConfigured()) {
                log.debug("useraccount empty with user JWT; retrying with service role for email match");
                return fetchUseraccountWithServiceRole(email);
            }
            return Optional.empty();
        } catch (HttpClientErrorException e) {
            int code = e.getStatusCode().value();
            if ((code == HttpStatus.UNAUTHORIZED.value() || code == HttpStatus.FORBIDDEN.value())
                    && serviceRoleConfigured()) {
                log.warn("useraccount lookup with user JWT failed ({}), retrying with service role", code);
                return fetchUseraccountWithServiceRole(email);
            }
            log.error("Failed to look up useraccount by email: {}", e.getMessage());
            return Optional.empty();
        } catch (Exception e) {
            log.error("Failed to look up useraccount by email: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<UserAccount> fetchUseraccountWithUserJwt(String email, String userJwt) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseAnonKey);
        headers.set("Authorization", "Bearer " + userJwt);

        String url = supabaseUrl + "/rest/v1/useraccount?select=*&limit=1";

        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

        JsonNode array = objectMapper.readTree(response.getBody());
        if (array == null || array.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(mapUseraccountRow(array.get(0)));
    }

    /**
     * Loads exactly one row for the verified JWT email. Only used after JWT signature verification.
     */
    private Optional<UserAccount> fetchUseraccountWithServiceRole(String email) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", supabaseServiceRoleKey);
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);

            String url = UriComponentsBuilder.fromHttpUrl(supabaseUrl + "/rest/v1/useraccount")
                    .queryParam("select", "*")
                    .queryParam("email", "eq." + email)
                    .queryParam("limit", 1)
                    .encode(StandardCharsets.UTF_8)
                    .toUriString();

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || array.isEmpty()) {
                return Optional.empty();
            }

            return Optional.of(mapUseraccountRow(array.get(0)));
        } catch (Exception e) {
            log.error("Service role useraccount lookup failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private UserAccount mapUseraccountRow(JsonNode node) {
        UserAccount user = new UserAccount();
        user.setUserId(node.has("user_id") && !node.get("user_id").isNull()
                ? node.get("user_id").asInt() : null);
        user.setEmail(node.has("email") ? node.get("email").asText() : null);
        user.setPassword(node.has("password") ? node.get("password").asText() : null);
        user.setRole(node.has("role") && !node.get("role").isNull()
                ? Role.valueOf(node.get("role").asText()) : null);
        user.setLinkedEntityId(node.has("linked_entity_id") && !node.get("linked_entity_id").isNull()
                ? node.get("linked_entity_id").asText() : null);
        return user;
    }

    private static String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void debugLog(String runId, String hypothesisId, String location, String message, String dataJson) {
        try {
            String payload = "{\"sessionId\":\"f639a7\",\"runId\":\"" + escapeJson(runId)
                    + "\",\"hypothesisId\":\"" + escapeJson(hypothesisId)
                    + "\",\"location\":\"" + escapeJson(location)
                    + "\",\"message\":\"" + escapeJson(message)
                    + "\",\"data\":{" + dataJson + "},\"timestamp\":" + System.currentTimeMillis() + "}\n";
            Files.writeString(
                    Path.of("/Users/apple/Desktop/InternAL/.cursor/debug-f639a7.log"),
                    payload,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND
            );
        } catch (Exception ignored) {
            /* debug logging must never break lookup flow */
        }
    }
}
