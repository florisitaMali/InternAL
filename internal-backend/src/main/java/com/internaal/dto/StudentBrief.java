package com.internaal.dto;

/**
 * Minimal student fields for cross-table workflows (e.g. routing notifications by university).
 */
public record StudentBrief(Integer universityId, String fullName) {}
