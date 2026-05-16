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
        int applicantCount,
        /**
         * This admin’s university’s collaboration row for the listing: PENDING, APPROVED, REJECTED;
         * null when the opportunity is open to all universities (no specific target row).
         */
        String viewerCollaborationStatus
) {
}
