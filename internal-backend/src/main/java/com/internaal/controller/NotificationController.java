package com.internaal.controller;

import com.internaal.dto.NotificationsListResponse;
import com.internaal.entity.UserAccount;
import com.internaal.repository.NotificationRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;

    public NotificationController(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @AuthenticationPrincipal UserAccount user,
            HttpServletRequest request) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthenticated"));
        }
        String jwt = extractBearerToken(request);
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Missing bearer token"));
        }
        int recipientId = parseLinkedEntityId(user);
        NotificationsListResponse body = notificationRepository.listForRecipient(
                user.getRole(),
                recipientId,
                jwt
        );
        return ResponseEntity.ok(body);
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<?> patchRead(
            @AuthenticationPrincipal UserAccount user,
            HttpServletRequest request,
            @PathVariable int notificationId,
            @RequestBody Map<String, Object> body) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthenticated"));
        }
        String jwt = extractBearerToken(request);
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Missing bearer token"));
        }
        boolean read = true;
        if (body != null && body.containsKey("read")) {
            Object v = body.get("read");
            if (v instanceof Boolean b) {
                read = b;
            } else if (v instanceof String s) {
                read = Boolean.parseBoolean(s);
            }
        }
        int recipientId = parseLinkedEntityId(user);
        boolean ok = notificationRepository.markRead(notificationId, user.getRole(), recipientId, read, jwt);
        if (!ok) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not update notification"));
        }
        return ResponseEntity.ok(Map.of("notificationId", notificationId, "read", read));
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> readAll(
            @AuthenticationPrincipal UserAccount user,
            HttpServletRequest request) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthenticated"));
        }
        String jwt = extractBearerToken(request);
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Missing bearer token"));
        }
        int recipientId = parseLinkedEntityId(user);
        notificationRepository.markAllRead(user.getRole(), recipientId, jwt);
        NotificationsListResponse refreshed = notificationRepository.listForRecipient(
                user.getRole(),
                recipientId,
                jwt
        );
        return ResponseEntity.ok(Map.of(
                "updated", true,
                "notifications", refreshed.notifications(),
                "unreadCount", refreshed.unreadCount()
        ));
    }

    private String extractBearerToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return authHeader.substring(7);
    }

    private int parseLinkedEntityId(UserAccount user) {
        try {
            return Integer.parseInt(user.getLinkedEntityId().trim());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Account linked_entity_id must be numeric");
        }
    }
}
