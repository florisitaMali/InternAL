package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OpportunityResponseItem(
        Integer id,
        Integer companyId,
        String companyName,
        String title,
        String description,
        List<String> requiredSkills,
        String requiredExperience,
        LocalDate deadline,
        List<Integer> targetUniversityIds,
        String type,
        String location,
        Boolean isPaid,
        String workMode,
        int skillMatchCount,
        String workType,
        String duration,
        String code,
        Integer positionCount,
        Integer salaryMonthly,
        String niceToHave,
        LocalDate startDate,
        String createdAt,
        Integer applicantCount
) {
}
