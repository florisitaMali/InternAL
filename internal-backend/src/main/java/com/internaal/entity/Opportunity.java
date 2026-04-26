package com.internaal.entity;

import java.time.LocalDate;
import java.util.List;

public record Opportunity(
        Integer id,
        Integer companyId,
        String companyName,
        String title,
        String description,
        List<String> requiredSkills,
        String requiredExperience,
        LocalDate deadline,
        List<Integer> targetUniversityIds,
        InternshipType type,
        String location,
        Boolean isPaid,
        WorkMode workMode,
        String workType,
        String duration,
        String typeRaw,
        String code,
        Integer positionCount,
        Integer salaryMonthly,
        String niceToHave,
        LocalDate startDate,
        String createdAt
) {
    public enum InternshipType {
        PROFESSIONAL_PRACTICE,
        INDIVIDUAL_GROWTH
    }

    public enum WorkMode {
        Remote,
        Hybrid,
        On_site;

        public static WorkMode fromDb(String value) {
            if (value == null || value.isBlank()) {
                return null;
            }
            String v = value.trim();
            if ("On-site".equalsIgnoreCase(v) || "ON_SITE".equalsIgnoreCase(v) || "onsite".equalsIgnoreCase(v)
                    || "IN-PERSON".equalsIgnoreCase(v) || "IN_PERSON".equalsIgnoreCase(v)) {
                return On_site;
            }
            if ("remote".equalsIgnoreCase(v)) {
                return Remote;
            }
            if ("hybrid".equalsIgnoreCase(v)) {
                return Hybrid;
            }
            return null;
        }

        public String toApiValue() {
            return this == On_site ? "On-site" : name();
        }
    }
}
