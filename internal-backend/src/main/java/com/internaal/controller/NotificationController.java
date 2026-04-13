package com.internaal.controller;

import com.internaal.entity.UserAccount;
import com.internaal.repository.NotificationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;

    public NotificationController(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal UserAccount user) {
        if (user == null) {
            return ResponseEntity.ok(List.of());
        }
        int recipientId;
        try {
            recipientId = Integer.parseInt(user.getLinkedEntityId().trim());
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(
                notificationRepository.findForRecipient(user.getRole().name(), recipientId)
        );
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<?> markRead(
            @PathVariable long notificationId,
            @AuthenticationPrincipal UserAccount user) {
        int recipientId;
        try {
            recipientId = Integer.parseInt(user.getLinkedEntityId().trim());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid linked entity for user."));
        }
        boolean ok = notificationRepository.markRead(notificationId, user.getRole().name(), recipientId);
        if (!ok) {
            return ResponseEntity.status(404).body(Map.of("error", "Notification not found or not allowed."));
        }
        return ResponseEntity.noContent().build();
    }
}
