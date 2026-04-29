package com.internaal.dto;

import java.util.List;

public record NotificationsListResponse(
        List<NotificationItemResponse> notifications,
        int unreadCount
) {}
