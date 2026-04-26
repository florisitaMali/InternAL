package com.internaal.dto;

public record AdminCompanySummaryResponse(
        int companyId,
        String name,
        String industry
) {
}
