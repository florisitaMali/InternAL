package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.NotificationItemResponse;
import com.internaal.dto.NotificationsListResponse;
import com.internaal.entity.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Repository
public class NotificationRepository {

    private static final Logger log = LoggerFactory.getLogger(NotificationRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String supabaseAnonKey;
    private final String supabaseServiceRoleKey;

    public NotificationRepository(
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

    public NotificationsListResponse listForRecipient(Role recipientRole, int recipientId, String userJwt) {
        try {
            JsonNode rows = fetchNotificationsArray(recipientRole, recipientId, userJwt);
            if (rows == null || !rows.isArray()) {
                return new NotificationsListResponse(List.of(), 0);
            }

            Map<String, SenderInfo> senderCache = new HashMap<>();
            List<NotificationItemResponse> items = new ArrayList<>();
            int unread = 0;

            for (JsonNode row : rows) {
                Integer id = intValue(row, "notification_id");
                if (id == null) {
                    continue;
                }
                String message = textValue(row, "message");
                Boolean isRead = boolValue(row, "is_read");
                String createdAt = textValue(row, "created_at");
                if (isRead == null) {
                    isRead = Boolean.FALSE;
                }
                if (!isRead) {
                    unread++;
                }

                String senderRoleStr = textValue(row, "sender_role");
                Integer senderId = intValue(row, "sender_id");
                SenderInfo sender = resolveSender(senderRoleStr, senderId, userJwt, senderCache);
                Integer applicationId = intValue(row, "application_id");

                items.add(new NotificationItemResponse(
                        id,
                        message == null ? "" : message,
                        isRead,
                        createdAt == null ? "" : createdAt,
                        sender.name(),
                        sender.photoUrl(),
                        sender.initials(),
                        sender.roleLabel(),
                        applicationId
                ));
            }

            return new NotificationsListResponse(items, unread);
        } catch (Exception e) {
            log.error("listForRecipient failed: {}", e.getMessage(), e);
            return new NotificationsListResponse(List.of(), 0);
        }
    }

    public boolean markRead(int notificationId, Role recipientRole, int recipientId, boolean read, String userJwt) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/notification")
                    .queryParam("notification_id", "eq." + notificationId)
                    .queryParam("recipient_id", "eq." + recipientId)
                    .queryParam("recipient_role", "eq." + recipientRole.name())
                    .toUriString();

            HttpHeaders headers = writeHeaders(userJwt);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Prefer", "return=minimal");

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("is_read", read);

            restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                    String.class
            );
            return true;
        } catch (HttpClientErrorException e) {
            log.warn("markRead HTTP error: {}", e.getStatusCode());
            return false;
        } catch (Exception e) {
            log.error("markRead failed: {}", e.getMessage(), e);
            return false;
        }
    }

    public int markAllRead(Role recipientRole, int recipientId, String userJwt) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/notification")
                    .queryParam("recipient_id", "eq." + recipientId)
                    .queryParam("recipient_role", "eq." + recipientRole.name())
                    .toUriString();

            HttpHeaders headers = writeHeaders(userJwt);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Prefer", "return=minimal");

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("is_read", true);

            restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                    String.class
            );
            return 1;
        } catch (Exception e) {
            log.error("markAllRead failed: {}", e.getMessage(), e);
            return 0;
        }
    }

    /**
     * Inserts a notification (service role). PPA recipients use {@code university_id} as {@code recipient_id}
     * to match {@code useraccount.linked_entity_id} for PPA accounts.
     */
    public boolean insertNotification(
            Role recipientRole,
            int recipientId,
            String message,
            Role senderRole,
            int senderId) {
        return insertNotification(recipientRole, recipientId, message, senderRole, senderId, null);
    }

    /**
     * @param applicationId optional FK for student deep-link (omit column when null).
     */
    public boolean insertNotification(
            Role recipientRole,
            int recipientId,
            String message,
            Role senderRole,
            int senderId,
            Integer applicationId) {
        if (!serviceRoleConfigured()) {
            log.warn("insertNotification skipped: SUPABASE_SERVICE_ROLE_KEY is not set");
            return false;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", supabaseServiceRoleKey);
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Prefer", "return=minimal");

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("recipient_role", recipientRole.name());
            row.put("recipient_id", recipientId);
            row.put("message", message);
            row.put("is_read", false);
            row.put("sender_role", senderRole.name());
            row.put("sender_id", senderId);
            if (applicationId != null) {
                row.put("application_id", applicationId);
            }

            String url = supabaseUrl + "/rest/v1/notification";
            String payload = objectMapper.writeValueAsString(List.of(row));
            restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    new HttpEntity<>(payload, headers),
                    String.class
            );
            return true;
        } catch (Exception e) {
            log.error("insertNotification failed: {}", e.getMessage(), e);
            return false;
        }
    }

    private JsonNode fetchNotificationsArray(Role recipientRole, int recipientId, String userJwt) throws Exception {
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/notification")
                .queryParam("recipient_role", "eq." + recipientRole.name())
                .queryParam("recipient_id", "eq." + recipientId)
                .queryParam("select", "*")
                .queryParam("order", "created_at.desc")
                .queryParam("limit", "200")
                .toUriString();

        HttpHeaders headers = readHeaders(userJwt);
        return fetchArray(url, headers);
    }

    private SenderInfo resolveSender(
            String senderRoleStr,
            Integer senderId,
            String userJwt,
            Map<String, SenderInfo> cache) {
        if (senderRoleStr == null || senderRoleStr.isBlank() || senderId == null) {
            return SenderInfo.system();
        }
        Role senderRole;
        try {
            senderRole = Role.valueOf(senderRoleStr.trim());
        } catch (IllegalArgumentException e) {
            return SenderInfo.fallback(senderRoleStr, senderId);
        }

        String cacheKey = senderRole.name() + ":" + senderId;
        if (cache.containsKey(cacheKey)) {
            return cache.get(cacheKey);
        }

        SenderInfo loaded = switch (senderRole) {
            case STUDENT -> loadStudentSender(senderId, userJwt);
            case COMPANY -> loadCompanySender(senderId, userJwt);
            case PPA -> loadPpaSender(senderId, userJwt);
            case UNIVERSITY_ADMIN -> loadUniversitySender(senderId, userJwt);
            case SYSTEM_ADMIN -> SenderInfo.fallback("SYSTEM_ADMIN", senderId);
        };
        cache.put(cacheKey, loaded);
        return loaded;
    }

    private SenderInfo loadStudentSender(int studentId, String userJwt) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/student")
                    .queryParam("student_id", "eq." + studentId)
                    .queryParam("select", "student_id,full_name,studentprofile(photo)")
                    .toUriString();
            JsonNode arr = fetchArray(url, readHeaders(userJwt));
            if (arr == null || arr.isEmpty()) {
                return SenderInfo.fallback("STUDENT", studentId);
            }
            JsonNode node = arr.get(0);
            String name = textValue(node, "full_name");
            String photo = null;
            JsonNode profile = node.get("studentprofile");
            if (profile != null && !profile.isNull()) {
                if (profile.isArray() && profile.size() > 0) {
                    photo = textValue(profile.get(0), "photo");
                } else if (profile.isObject()) {
                    photo = textValue(profile, "photo");
                }
            }
            return new SenderInfo(
                    name != null && !name.isBlank() ? name : "Student",
                    blankToNull(photo),
                    initialsFromName(name),
                    "STUDENT"
            );
        } catch (Exception e) {
            log.debug("loadStudentSender failed: {}", e.getMessage());
            return SenderInfo.fallback("STUDENT", studentId);
        }
    }

    private SenderInfo loadCompanySender(int companyId, String userJwt) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/company")
                    .queryParam("company_id", "eq." + companyId)
                    .queryParam("select", "company_id,name,logo_url")
                    .toUriString();
            JsonNode arr = fetchArray(url, readHeaders(userJwt));
            if (arr == null || arr.isEmpty()) {
                return SenderInfo.fallback("COMPANY", companyId);
            }
            JsonNode node = arr.get(0);
            String name = textValue(node, "name");
            String logo = textValue(node, "logo_url");
            return new SenderInfo(
                    name != null && !name.isBlank() ? name : "Company",
                    blankToNull(logo),
                    initialsFromName(name),
                    "COMPANY"
            );
        } catch (Exception e) {
            log.debug("loadCompanySender failed: {}", e.getMessage());
            return SenderInfo.fallback("COMPANY", companyId);
        }
    }

    private SenderInfo loadPpaSender(int ppaId, String userJwt) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/professionalpracticeapprover")
                    .queryParam("ppa_id", "eq." + ppaId)
                    .queryParam("select", "ppa_id,full_name")
                    .toUriString();
            JsonNode arr = fetchArray(url, readHeaders(userJwt));
            if (arr == null || arr.isEmpty()) {
                return SenderInfo.fallback("PPA", ppaId);
            }
            JsonNode node = arr.get(0);
            String name = textValue(node, "full_name");
            return new SenderInfo(
                    name != null && !name.isBlank() ? name : "PP Approver",
                    null,
                    initialsFromName(name),
                    "PPA"
            );
        } catch (Exception e) {
            log.debug("loadPpaSender failed: {}", e.getMessage());
            return SenderInfo.fallback("PPA", ppaId);
        }
    }

    private SenderInfo loadUniversitySender(int universityId, String userJwt) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/university")
                    .queryParam("university_id", "eq." + universityId)
                    .queryParam("select", "university_id,name")
                    .toUriString();
            JsonNode arr = fetchArray(url, readHeaders(userJwt));
            if (arr == null || arr.isEmpty()) {
                return SenderInfo.fallback("UNIVERSITY_ADMIN", universityId);
            }
            JsonNode node = arr.get(0);
            String name = textValue(node, "name");
            return new SenderInfo(
                    name != null && !name.isBlank() ? name : "University",
                    null,
                    initialsFromName(name),
                    "UNIVERSITY_ADMIN"
            );
        } catch (Exception e) {
            log.debug("loadUniversitySender failed: {}", e.getMessage());
            return SenderInfo.fallback("UNIVERSITY_ADMIN", universityId);
        }
    }

    private JsonNode fetchArray(String url, HttpHeaders headers) throws Exception {
        ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );
        if (response.getBody() == null || response.getBody().isBlank()) {
            return null;
        }
        return objectMapper.readTree(response.getBody());
    }

    private HttpHeaders readHeaders(String userJwt) {
        if (serviceRoleConfigured()) {
            return createServiceHeaders();
        }
        return createUserHeaders(userJwt);
    }

    private HttpHeaders writeHeaders(String userJwt) {
        if (serviceRoleConfigured()) {
            return createServiceHeaders();
        }
        return createUserHeaders(userJwt);
    }

    private HttpHeaders createUserHeaders(String userJwt) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseAnonKey);
        headers.set("Authorization", "Bearer " + (userJwt == null ? "" : userJwt));
        return headers;
    }

    private HttpHeaders createServiceHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseServiceRoleKey);
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        return headers;
    }

    private boolean serviceRoleConfigured() {
        return supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank();
    }

    private static Integer intValue(JsonNode node, String field) {
        return node != null && node.has(field) && !node.get(field).isNull() ? node.get(field).asInt() : null;
    }

    private static Boolean boolValue(JsonNode node, String field) {
        return node != null && node.has(field) && !node.get(field).isNull() ? node.get(field).asBoolean() : null;
    }

    private static String textValue(JsonNode node, String field) {
        return node != null && node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }

    private static String blankToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }

    private static String initialsFromName(String name) {
        if (name == null || name.isBlank()) {
            return "?";
        }
        String[] parts = name.trim().split("\\s+");
        if (parts.length == 1) {
            String p = parts[0];
            return p.length() >= 2 ? p.substring(0, 2).toUpperCase() : p.toUpperCase();
        }
        return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
    }

    private record SenderInfo(String name, String photoUrl, String initials, String roleLabel) {
        static SenderInfo system() {
            return new SenderInfo("InternAL", null, "IN", "SYSTEM");
        }

        static SenderInfo fallback(String role, int id) {
            return new SenderInfo("User #" + id, null, "?", role);
        }
    }
}
