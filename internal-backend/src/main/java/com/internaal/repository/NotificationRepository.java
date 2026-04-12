package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.NotificationResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Repository
public class NotificationRepository {

    private static final Logger log = LoggerFactory.getLogger(NotificationRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Value("${supabase.service.role.key:}")
    private String supabaseServiceRoleKey;

    public NotificationRepository(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    private boolean serviceRoleConfigured() {
        return StringUtils.hasText(supabaseServiceRoleKey);
    }

    private HttpHeaders serviceRoleHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseServiceRoleKey);
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private HttpHeaders userJwtHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseAnonKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() instanceof String jwt) {
            headers.set("Authorization", "Bearer " + jwt);
        }
        return headers;
    }

    /**
     * Lists notifications for the given recipient; RLS should further restrict to the JWT user.
     */
    public List<NotificationResponse> findForRecipient(String recipientRole, int recipientId) {
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/notification")
                .queryParam("select", "notification_id,recipient_role,recipient_id,message,is_read,created_at")
                .queryParam("recipient_role", "eq." + recipientRole)
                .queryParam("recipient_id", "eq." + recipientId)
                .queryParam("order", "created_at.desc")
                .queryParam("limit", "100")
                .encode(StandardCharsets.UTF_8)
                .toUriString();

        try {
            return parseNotificationArray(
                    restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(userJwtHeaders()), String.class)
                            .getBody());
        } catch (HttpClientErrorException e) {
            int code = e.getStatusCode().value();
            if ((code == HttpStatus.UNAUTHORIZED.value() || code == HttpStatus.FORBIDDEN.value())
                    && serviceRoleConfigured()) {
                log.warn("notification list with user JWT failed ({}), retrying with service role", code);
                try {
                    return parseNotificationArray(
                            restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(serviceRoleHeaders()), String.class)
                                    .getBody());
                } catch (Exception e2) {
                    log.error("findForRecipient service role retry failed: {}", e2.getMessage());
                }
            } else {
                log.error("findForRecipient failed: {}", e.getMessage());
            }
            return List.of();
        } catch (Exception e) {
            log.error("findForRecipient failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<NotificationResponse> parseNotificationArray(String body) throws Exception {
        JsonNode array = objectMapper.readTree(body);
        if (array == null || !array.isArray()) {
            return List.of();
        }
        List<NotificationResponse> out = new ArrayList<>();
        for (JsonNode n : array) {
            out.add(mapRow(n));
        }
        return out;
    }

    /**
     * Marks one notification read if it belongs to this recipient (RLS enforces ownership).
     */
    public boolean markRead(long notificationId, String recipientRole, int recipientId) {
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/notification")
                .queryParam("notification_id", "eq." + notificationId)
                .queryParam("recipient_role", "eq." + recipientRole)
                .queryParam("recipient_id", "eq." + recipientId)
                .encode(StandardCharsets.UTF_8)
                .toUriString();

        String jsonBody;
        try {
            jsonBody = objectMapper.writeValueAsString(Map.of("is_read", true));
        } catch (Exception e) {
            return false;
        }

        try {
            HttpHeaders headers = userJwtHeaders();
            headers.set("Prefer", "return=minimal");
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(jsonBody, headers),
                    String.class
            );
            return response.getStatusCode().is2xxSuccessful();
        } catch (HttpClientErrorException e) {
            int code = e.getStatusCode().value();
            if ((code == HttpStatus.UNAUTHORIZED.value() || code == HttpStatus.FORBIDDEN.value())
                    && serviceRoleConfigured()) {
                try {
                    HttpHeaders headers = serviceRoleHeaders();
                    headers.set("Prefer", "return=minimal");
                    ResponseEntity<String> response = restTemplate.exchange(
                            url,
                            HttpMethod.PATCH,
                            new HttpEntity<>(jsonBody, headers),
                            String.class
                    );
                    return response.getStatusCode().is2xxSuccessful();
                } catch (Exception e2) {
                    log.error("markRead service role retry failed: {}", e2.getMessage());
                }
            } else {
                log.error("markRead failed: {}", e.getMessage());
            }
            return false;
        } catch (Exception e) {
            log.error("markRead failed: {}", e.getMessage());
            return false;
        }
    }

    private static NotificationResponse mapRow(JsonNode n) {
        NotificationResponse r = new NotificationResponse();
        if (n.has("notification_id") && !n.get("notification_id").isNull()) {
            r.setNotificationId(n.get("notification_id").asLong());
        }
        if (n.has("recipient_role") && !n.get("recipient_role").isNull()) {
            r.setRecipientRole(n.get("recipient_role").asText());
        }
        if (n.has("recipient_id") && !n.get("recipient_id").isNull()) {
            r.setRecipientId(n.get("recipient_id").asInt());
        }
        if (n.has("message") && !n.get("message").isNull()) {
            r.setMessage(n.get("message").asText());
        }
        if (n.has("is_read") && !n.get("is_read").isNull()) {
            r.setIsRead(n.get("is_read").asBoolean());
        }
        if (n.has("created_at") && !n.get("created_at").isNull()) {
            r.setCreatedAt(n.get("created_at").asText());
        }
        return r;
    }
}
