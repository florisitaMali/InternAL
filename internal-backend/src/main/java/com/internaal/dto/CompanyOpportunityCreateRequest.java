package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CompanyOpportunityCreateRequest(
        String title,
        String description,
        List<String> requiredSkills,
        /** Qualifications / requirements text (stored in {@code required_experience}). */
        String requirements,
        LocalDate deadline,
        /** Expected start of the role / internship (optional). */
        LocalDate startDate,
        List<Integer> targetUniversityIds,
        Integer positionCount,
        String jobLocation,
        /** Remote, Hybrid, or On-site (maps to {@code work_mode}). */
        String workplaceType,
        /** FULL_TIME or PART_TIME. */
        String workType,
        /** e.g. 3_MONTHS, 6_MONTHS, 12_MONTHS. */
        String duration,
        Boolean paid,
        Integer salaryMonthly,
        String niceToHave,
        /** Optional free-text category stored in {@code opportunity.type}; defaults to {@code GENERAL} when omitted. */
        String type,
        /** When true, opportunity is hidden from students until published. */
        Boolean draft
) {
}
