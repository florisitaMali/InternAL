package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OpportunityResponseItem(
        Integer id,
        Integer companyId,
        String companyName,
        String affiliatedUniversityName,
        String title,
        String description,
        List<String> requiredSkills,
        String requiredExperience,
        LocalDate deadline,
        LocalDate startDate,
        List<Integer> targetUniversityIds,
        List<TargetUniversityOption> targetUniversities,
        /** Target universities that approved collaboration (company + admin detail). */
        List<TargetUniversityOption> collaborationApproved,
        /** Target universities that rejected collaboration. */
        List<TargetUniversityOption> collaborationRejected,
        /** Target universities with no decision yet. */
        List<TargetUniversityOption> collaborationPending,
        String type,
        String location,
        Boolean isPaid,
        String workMode,
        Integer positionCount,
        String workType,
        String duration,
        Integer salaryMonthly,
        String niceToHave,
        Boolean draft,
        Instant postedAt,
        int skillMatchCount,
        String code,
        String createdAt,
        Integer applicantCount,
        /** Human-readable collaboration line when targets exist, e.g. "Approved by A. Rejected by B. Pending: C". */
        String collaborationSummary
) {
}
