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
import org.springframework.web.client.RestTemplate;

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

    public UserAccountRepository(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon.key}") String supabaseAnonKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl;
        this.supabaseAnonKey = supabaseAnonKey;
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
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", supabaseAnonKey);
            headers.set("Authorization", "Bearer " + userJwt);

            String encodedEmail = URLEncoder.encode(email, StandardCharsets.UTF_8);
            String url = supabaseUrl + "/rest/v1/useraccount?select=*&limit=1";
            // #region agent log
            debugLog("lookup-debug", "H6_H7_H8", "internal-backend/src/main/java/com/internaal/repository/UserAccountRepository.java:54",
                    "useraccount request prepared",
                    "\"emailLength\":" + (email == null ? 0 : email.length())
                            + ",\"containsAt\":" + (email != null && email.contains("@"))
                            + ",\"encodedDiffers\":" + (email != null && !encodedEmail.equals(email)));
            // #endregion

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            // #region agent log
            debugLog("lookup-debug", "H6_H7_H8", "internal-backend/src/main/java/com/internaal/repository/UserAccountRepository.java:58",
                    "useraccount response received",
                    "\"status\":" + response.getStatusCode().value()
                            + ",\"bodyLength\":" + (response.getBody() == null ? 0 : response.getBody().length()));
            // #endregion

            JsonNode array = objectMapper.readTree(response.getBody());
            // #region agent log
            debugLog("lookup-debug", "H6_H7", "internal-backend/src/main/java/com/internaal/repository/UserAccountRepository.java:61",
                    "useraccount body parsed",
                    "\"isArray\":" + (array != null && array.isArray())
                            + ",\"isEmpty\":" + (array == null || array.isEmpty())
                            + ",\"resultCount\":" + (array != null && array.isArray() ? array.size() : -1));
            // #endregion
            if (array == null || array.isEmpty()) {
                ResponseEntity<String> diagnosticResponse = restTemplate.exchange(
                        supabaseUrl + "/rest/v1/useraccount?select=email&limit=1",
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        String.class
                );
                JsonNode diagnosticArray = objectMapper.readTree(diagnosticResponse.getBody());
                // #region agent log
                debugLog("lookup-debug", "H9_H10", "internal-backend/src/main/java/com/internaal/repository/UserAccountRepository.java:67",
                        "diagnostic useraccount visibility check",
                        "\"status\":" + diagnosticResponse.getStatusCode().value()
                                + ",\"visibleRowCount\":" + (diagnosticArray != null && diagnosticArray.isArray() ? diagnosticArray.size() : -1));
                // #endregion
                return Optional.empty();
            }

            JsonNode node = array.get(0);
            UserAccount user = new UserAccount();
            user.setUserId(node.has("user_id") && !node.get("user_id").isNull()
                    ? node.get("user_id").asInt() : null);
            user.setEmail(node.has("email") ? node.get("email").asText() : null);
            user.setPassword(node.has("password") ? node.get("password").asText() : null);
            user.setRole(node.has("role") && !node.get("role").isNull()
                    ? Role.valueOf(node.get("role").asText()) : null);
            user.setLinkedEntityId(node.has("linked_entity_id") && !node.get("linked_entity_id").isNull()
                    ? node.get("linked_entity_id").asText() : null);
            return Optional.of(user);

        } catch (Exception e) {
            // #region agent log
            debugLog("lookup-debug", "H6_H7_H8", "internal-backend/src/main/java/com/internaal/repository/UserAccountRepository.java:76",
                    "useraccount lookup exception",
                    "\"exceptionClass\":\"" + escapeJson(e.getClass().getName())
                            + "\",\"message\":\"" + escapeJson(e.getMessage()) + "\"");
            // #endregion
            log.error("Failed to look up useraccount by email: {}", e.getMessage());
            return Optional.empty();
        }
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
