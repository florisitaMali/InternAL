package com.internaal.dto;

public record OpportunityApplicationStatsDto(
        int total,
        int inReview,
        int approved,
        int rejected
) {
}
