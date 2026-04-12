package com.internaal.dto;

public record CompanyOpportunityDetailResponse(
        OpportunityResponseItem opportunity,
        OpportunityApplicationStatsDto applicationStats
) {
}
