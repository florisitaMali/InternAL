package com.internaal.controller;

import com.internaal.entity.UserAccount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@RestController
public class HealthCheckController {

    private final RestTemplate restTemplate;

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    public HealthCheckController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @GetMapping("/api/health")
    public ResponseEntity<String> healthCheck() {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", supabaseAnonKey);
            headers.set("Authorization", "Bearer " + supabaseAnonKey);

            // Query useraccount with limit=0 just to verify connectivity
            restTemplate.exchange(
                    supabaseUrl + "/rest/v1/useraccount?select=user_id&limit=0",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );

            return ResponseEntity.ok("{\"status\": \"connected\"}");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("{\"status\": \"error\", \"message\": \"" + e.getMessage().replace("\"", "'") + "\"}");
        }
    }

    @GetMapping("/api/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal UserAccount user) {
        Map<String, Object> body = new HashMap<>();
        body.put("userId", user.getUserId());
        body.put("email", user.getEmail());
        body.put("role", user.getRole().name());
        body.put("linkedEntityId", user.getLinkedEntityId());
        return ResponseEntity.ok(body);
    }
}
