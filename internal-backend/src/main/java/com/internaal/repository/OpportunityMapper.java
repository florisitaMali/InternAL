package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.TargetUniversityOption;
import com.internaal.entity.Opportunity;
import com.internaal.entity.TargetUniversity;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Maps PostgREST JSON rows for {@code opportunity} (+ embedded {@code company}, {@code opportunitytarget}) to {@link Opportunity}.
 */
public final class OpportunityMapper {

    private OpportunityMapper() {}

    /** Maps a loaded {@link Opportunity} to the public list/detail DTO (e.g. admin or company APIs). */
    public static OpportunityResponseItem toResponseItem(Opportunity o, int skillMatchCount) {
        return toResponseItem(o, skillMatchCount, 0);
    }

    /**
     * @param applicantCount total applications for this opportunity (student-facing stats); use 0 when unknown.
     */
    public static OpportunityResponseItem toResponseItem(Opportunity o, int skillMatchCount, int applicantCount) {
        if (o == null) {
            return null;
        }
        List<Integer> targetIds = o.targetUniversities() == null
                ? List.of()
                : o.targetUniversities().stream().map(TargetUniversity::id).toList();
        List<TargetUniversityOption> targetOpts;
        if (o.targetUniversities() == null || o.targetUniversities().isEmpty()) {
            targetOpts = List.of();
        } else {
            targetOpts = o.targetUniversities().stream()
                    .map(t -> new TargetUniversityOption(
                            t.id(),
                            t.name() != null && !t.name().isBlank() ? t.name() : ("University " + t.id())))
                    .toList();
        }
        String wm = o.workMode() == null ? null : o.workMode().toApiValue();
        return new OpportunityResponseItem(
                o.id(),
                o.companyId(),
                o.companyName(),
                o.affiliatedUniversityName(),
                o.title(),
                o.description(),
                o.requiredSkills(),
                o.requiredExperience(),
                o.deadline(),
                o.startDate(),
                targetIds,
                targetOpts,
                o.type(),
                o.location(),
                o.isPaid(),
                wm,
                o.positionCount(),
                o.workType(),
                o.duration(),
                o.salaryMonthly(),
                o.niceToHave(),
                o.draft(),
                o.postedAt(),
                skillMatchCount,
                o.code(),
                o.createdAt(),
                applicantCount);
    }

    public static Opportunity fromJsonNode(JsonNode node) {
        Integer id = intVal(node, "opportunity_id");
        Integer companyId = intVal(node, "company_id");

        JsonNode company = node.get("company");
        String companyName = null;
        String companyLocation = null;
        String affiliatedUniversityName = null;
        if (company != null && !company.isNull()) {
            companyName = str(company, "name");
            companyLocation = str(company, "location");
            affiliatedUniversityName = embeddedUniversityName(company.get("university"));
        }

        String jobLocation = str(node, "job_location");
        String displayLocation =
                (jobLocation != null && !jobLocation.isBlank()) ? jobLocation.trim() : companyLocation;

        String title = str(node, "title");
        String description = str(node, "description");
        List<String> requiredSkills = skillsFromNode(node, "required_skills");
        String requiredExperience = str(node, "required_experience");

        LocalDate deadline = null;
        String deadlineStr = str(node, "deadline");
        if (deadlineStr != null) {
            try {
                deadline = LocalDate.parse(deadlineStr);
            } catch (Exception ignored) {
                // leave null
            }
        }

        LocalDate startDate = null;
        String startStr = str(node, "start_date");
        if (startStr != null) {
            try {
                startDate = LocalDate.parse(startStr);
            } catch (Exception ignored) {
                // leave null
            }
        }

        List<TargetUniversity> targetUniversities = new ArrayList<>();
        JsonNode targets = node.get("opportunitytarget");
        if (targets != null && !targets.isNull()) {
            if (targets.isArray()) {
                for (JsonNode t : targets) {
                    Integer uid = intVal(t, "university_id");
                    if (uid == null) {
                        continue;
                    }
                    String uniName = embeddedUniversityName(t.get("university"));
                    targetUniversities.add(new TargetUniversity(uid, uniName));
                }
            } else if (targets.isObject()) {
                Integer uid = intVal(targets, "university_id");
                if (uid != null) {
                    String uniName = embeddedUniversityName(targets.get("university"));
                    targetUniversities.add(new TargetUniversity(uid, uniName));
                }
            }
        }

        String type = str(node, "type");
        if (type != null) {
            type = type.trim();
            if (type.isEmpty()) {
                type = null;
            }
        }

        Boolean isPaid = boolVal(node, "is_paid");
        Opportunity.WorkMode workMode = Opportunity.WorkMode.fromDb(str(node, "work_mode"));

        Integer positionCount = intVal(node, "position_count");
        if (positionCount == null || positionCount < 1) {
            positionCount = 1;
        }

        String workType = str(node, "work_type");

        String code = str(node, "code");
        String createdAt = str(node, "created_at");
        String duration = str(node, "duration");
        Integer salaryMonthly = intVal(node, "salary_monthly");
        String niceToHave = str(node, "nice_to_have");

        boolean isDraft = Boolean.TRUE.equals(boolVal(node, "is_draft"));
        Instant postedAt = parseCreatedAtFromOpportunityJson(node);

        return new Opportunity(
                id,
                companyId,
                companyName,
                title,
                description,
                requiredSkills,
                requiredExperience,
                deadline,
                targetUniversities,
                type,
                displayLocation,
                isPaid,
                workMode,
                workType,
                duration,
                type,
                code,
                positionCount,
                salaryMonthly,
                niceToHave,
                startDate,
                createdAt,
                isDraft,
                postedAt,
                affiliatedUniversityName);
    }

    /**
     * Reads {@code created_at} from a PostgREST opportunity row (string or numeric epoch).
     * Handles common ISO variants and space-separated timestamps without {@code T}.
     */
    private static Instant parseCreatedAtFromOpportunityJson(JsonNode node) {
        if (node == null || !node.has("created_at") || node.get("created_at").isNull()) {
            return null;
        }
        JsonNode v = node.get("created_at");
        if (v.isIntegralNumber()) {
            long sec = v.asLong();
            return sec > 1_000_000_000_000L ? Instant.ofEpochMilli(sec) : Instant.ofEpochSecond(sec);
        }
        if (v.isFloatingPointNumber()) {
            double d = v.asDouble();
            return Instant.ofEpochMilli((long) d);
        }
        if (!v.isTextual()) {
            return null;
        }
        return parseCreatedAtString(v.asText());
    }

    private static Instant parseCreatedAtString(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
        try {
            return Instant.parse(s);
        } catch (DateTimeParseException ignored) {
            /* fall through */
        }
        try {
            return OffsetDateTime.parse(s).toInstant();
        } catch (DateTimeParseException ignored) {
            /* fall through */
        }
        String normalized = s.contains("T") ? s : s.replaceFirst(" ", "T");
        try {
            return OffsetDateTime.parse(normalized).toInstant();
        } catch (DateTimeParseException ignored) {
            /* fall through */
        }
        try {
            return LocalDateTime.parse(normalized, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                    .atOffset(ZoneOffset.UTC)
                    .toInstant();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    /** PostgREST may return {@code university} as object or single-element array. */
    private static String embeddedUniversityName(JsonNode universityNode) {
        if (universityNode == null || universityNode.isNull()) {
            return null;
        }
        JsonNode uni = universityNode.isArray() && !universityNode.isEmpty()
                ? universityNode.get(0)
                : universityNode;
        if (uni == null || uni.isNull()) {
            return null;
        }
        String n = str(uni, "name");
        if (n == null || n.isBlank()) {
            n = str(uni, "university_name");
        }
        if (n == null || n.isBlank()) {
            n = str(uni, "title");
        }
        return n;
    }

    /** Name from PostgREST embed {@code company(university(name))}. */
    public static String affiliatedUniversityFromCompanyEmbed(JsonNode companyNode) {
        if (companyNode == null || companyNode.isNull()) {
            return null;
        }
        return embeddedUniversityName(companyNode.get("university"));
    }

    /**
     * Fills missing {@link TargetUniversity#name()} from a lookup map (e.g. after batch load from {@code university}).
     */
    public static Opportunity enrichTargetUniversityNames(Opportunity o, java.util.Map<Integer, String> byId) {
        if (o == null || byId == null || byId.isEmpty() || o.targetUniversities() == null || o.targetUniversities().isEmpty()) {
            return o;
        }
        List<TargetUniversity> nu = new ArrayList<>();
        boolean changed = false;
        for (TargetUniversity t : o.targetUniversities()) {
            String n = t.name();
            if (n == null || n.isBlank()) {
                String resolved = byId.get(t.id());
                if (resolved != null && !resolved.isBlank()) {
                    n = resolved;
                    changed = true;
                }
            }
            nu.add(new TargetUniversity(t.id(), n));
        }
        if (!changed) {
            return o;
        }
        return new Opportunity(
                o.id(),
                o.companyId(),
                o.companyName(),
                o.title(),
                o.description(),
                o.requiredSkills(),
                o.requiredExperience(),
                o.deadline(),
                nu,
                o.type(),
                o.location(),
                o.isPaid(),
                o.workMode(),
                o.workType(),
                o.duration(),
                o.typeRaw(),
                o.code(),
                o.positionCount(),
                o.salaryMonthly(),
                o.niceToHave(),
                o.startDate(),
                o.createdAt(),
                o.draft(),
                o.postedAt(),
                o.affiliatedUniversityName());
    }

    static String str(JsonNode node, String field) {
        return (node != null && node.has(field) && !node.get(field).isNull())
                ? node.get(field).asText()
                : null;
    }

    static Integer intVal(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return null;
        }
        JsonNode v = node.get(field);
        if (v.isInt() || v.isLong()) {
            return v.asInt();
        }
        if (v.isNumber()) {
            try {
                return v.numberValue().intValue();
            } catch (ArithmeticException e) {
                return null;
            }
        }
        if (v.isTextual()) {
            try {
                return Integer.parseInt(v.asText().trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    static Boolean boolVal(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return null;
        }
        JsonNode v = node.get(field);
        if (v.isBoolean()) {
            return v.asBoolean();
        }
        if (v.isTextual()) {
            String s = v.asText().trim().toLowerCase();
            if ("true".equals(s) || "t".equals(s) || "1".equals(s)) {
                return true;
            }
            if ("false".equals(s) || "f".equals(s) || "0".equals(s)) {
                return false;
            }
        }
        return null;
    }

    /**
     * {@code required_skills} may be a CSV/text column or a JSON array from PostgREST.
     */
    public static List<String> skillsFromNode(JsonNode parent, String field) {
        if (parent == null || !parent.has(field) || parent.get(field).isNull()) {
            return List.of();
        }
        JsonNode v = parent.get(field);
        if (v.isArray()) {
            List<String> out = new ArrayList<>();
            for (JsonNode x : v) {
                if (x == null || x.isNull()) {
                    continue;
                }
                if (x.isTextual()) {
                    String s = x.asText().trim();
                    if (!s.isEmpty()) {
                        out.add(s);
                    }
                } else if (x.isNumber()) {
                    out.add(x.asText());
                }
            }
            return out;
        }
        return splitCsv(str(parent, field));
    }

    static List<String> splitCsv(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String s : raw.split(",")) {
            if (s != null && !s.isBlank()) {
                out.add(s.trim());
            }
        }
        return out;
    }

    /** Serialize skills for a {@code text} or CSV column. */
    public static String skillsToCsv(List<String> skills) {
        if (skills == null || skills.isEmpty()) {
            return "";
        }
        return String.join(",", skills.stream().map(String::trim).filter(s -> !s.isEmpty()).toList());
    }
}
