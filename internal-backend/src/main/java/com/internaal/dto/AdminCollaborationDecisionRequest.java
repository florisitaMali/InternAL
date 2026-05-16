package com.internaal.dto;

/**
 * Body for PATCH {@code /api/admin/opportunities/{id}/collaboration}.
 */
public record AdminCollaborationDecisionRequest(Boolean approved) {}
