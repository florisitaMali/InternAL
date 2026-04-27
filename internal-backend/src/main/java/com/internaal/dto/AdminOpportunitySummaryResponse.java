package com.internaal.dto;

public record AdminOpportunitySummaryResponse(
        int opportunityId,
        String title,
        String companyName,
        String deadline,
        String type
) {
}
