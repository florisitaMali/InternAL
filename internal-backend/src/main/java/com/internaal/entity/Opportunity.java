package com.internaal.entity;

import java.time.Instant;
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
        /** Expected role / internship start (optional). */
        LocalDate startDate,
        /** Empty = open to all universities. */
        List<TargetUniversity> targetUniversities,
        /** Stored as plain text in the database; not limited to specific enum values. */
        String type,
        String location,
        Boolean isPaid,
        WorkMode workMode,
        Integer positionCount,
        WorkType workType,
        String duration,
        Integer salaryMonthly,
        String niceToHave,
        boolean draft,
        /** From {@code opportunity.created_at}; when the listing was created. */
        Instant postedAt
) {
    public enum WorkType {
        FULL_TIME,
        PART_TIME
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
            if ("On-site".equalsIgnoreCase(v) || "ON_SITE".equalsIgnoreCase(v) || "onsite".equalsIgnoreCase(v)) {
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

        /** Human-readable strings returned in JSON to clients (matches frontend). */
        public String toApiValue() {
            return this == On_site ? "On-site" : name();
        }

        /**
         * Values stored in Postgres; many schemas use {@code work_mode_enum} with uppercase labels
         * ({@code REMOTE}, {@code HYBRID}, {@code ON_SITE}) instead of API-style strings.
         */
        public String toDbValue() {
            return switch (this) {
                case Remote -> "REMOTE";
                case Hybrid -> "HYBRID";
                case On_site -> "ON_SITE";
            };
        }
    }
}
