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

import java.util.Objects;
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
        Objects.requireNonNull(email, "email");
        try {
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
            log.error("Failed to look up useraccount by email: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
