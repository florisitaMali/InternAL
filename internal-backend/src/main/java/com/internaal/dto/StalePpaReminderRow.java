package com.internaal.dto;

/** PP queue row used for weekly stale reminders (> N days without PPA decision). */
public record StalePpaReminderRow(int applicationId, int universityId, String opportunityTitle) {}
