package com.internaal.dto;

import java.util.List;

public record AdminOpportunitySummaryResponse(
        int opportunityId,
        int companyId,
        String title,
        String companyName,
        String affiliatedUniversityName,
        String deadline,
        String type,
        List<String> targetUniversityNames,
        String description,
        String location,
        String workMode,
        String duration,
        String createdAt,
        List<String> requiredSkills,
        int applicantCount
) {
}
