package com.internaal.dto;

/**
 * University admin approves or rejects collaboration for an opportunity targeting their university.
 */
public record AdminOpportunityCollaborationDecisionRequest(boolean approved) {
}
