package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InstitutionalPartnershipUniversityItem(
        int universityId,
        String universityName,
        /** NONE when no row exists; otherwise PENDING, APPROVED, REJECTED. */
        String status,
        String requestedByRole,
        Integer requestedById,
        boolean canRequest,
        boolean canAccept,
        boolean canReject,
        boolean canEnd
) {}
