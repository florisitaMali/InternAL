package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record NotificationItemResponse(
        int notificationId,
        String message,
        @JsonProperty("isRead") boolean isRead,
        String createdAt,
        String senderName,
        String senderPhotoUrl,
        String senderInitials,
        String senderRole,
        Integer applicationId
) {}
