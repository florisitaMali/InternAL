package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.util.List;

/**
 * Partial update: only non-null fields are applied. For {@code targetUniversityIds},
 * {@code null} means leave targets unchanged; an empty list clears all targets (open to all universities).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CompanyOpportunityUpdateRequest(
        String title,
        String description,
        List<String> requiredSkills,
        String requirements,
        LocalDate deadline,
        LocalDate startDate,
        List<Integer> targetUniversityIds,
        String type,
        Integer positionCount,
        String jobLocation,
        String workplaceType,
        String workType,
        String duration,
        Boolean paid,
        Integer salaryMonthly,
        String niceToHave,
        Boolean draft
) {
}
