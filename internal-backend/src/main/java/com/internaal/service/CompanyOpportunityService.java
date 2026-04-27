package com.internaal.service;

import com.internaal.dto.CompanyOpportunitiesResponse;
import com.internaal.dto.CompanyOpportunityCreateRequest;
import com.internaal.dto.CompanyOpportunityDetailResponse;
import com.internaal.dto.CompanyOpportunityUpdateRequest;
import com.internaal.dto.OpportunityApplicationStatsDto;
import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.TargetUniversitiesResponse;
import com.internaal.dto.TargetUniversityOption;
import com.internaal.entity.Opportunity;
import com.internaal.entity.TargetUniversity;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.exception.ValidationException;
import com.internaal.repository.CompanyOpportunityWriteRepository;
import com.internaal.repository.OpportunityMapper;
import com.internaal.repository.OpportunityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CompanyOpportunityService {

    private final OpportunityRepository opportunityRepository;
    private final CompanyOpportunityWriteRepository writeRepository;

    public CompanyOpportunityService(
            OpportunityRepository opportunityRepository,
            CompanyOpportunityWriteRepository writeRepository) {
        this.opportunityRepository = opportunityRepository;
        this.writeRepository = writeRepository;
    }

    public CompanyOpportunitiesResponse list(UserAccount user) {
        requireCompany(user);
        int companyId = parseCompanyId(user);
        List<OpportunityResponseItem> items = opportunityRepository.findForCompanyId(companyId).stream()
                .map(CompanyOpportunityService::toItem)
                .toList();
        return new CompanyOpportunitiesResponse(items);
    }

    public TargetUniversitiesResponse listTargetUniversities(UserAccount user) {
        requireCompany(user);
        return new TargetUniversitiesResponse(
                opportunityRepository.findUniversitiesFromUniversityTable());
    }

    public CompanyOpportunityDetailResponse getById(UserAccount user, int opportunityId) {
        requireCompany(user);
        int companyId = parseCompanyId(user);
        Opportunity o = opportunityRepository.findByIdAndCompanyId(opportunityId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found"));
        return new CompanyOpportunityDetailResponse(toItem(o), emptyStats());
    }

    public CompanyOpportunityDetailResponse create(UserAccount user, CompanyOpportunityCreateRequest req) {
        requireCompany(user);
        int companyId = parseCompanyId(user);
        validateCreate(req);

        List<Integer> targets = req.targetUniversityIds() != null ? req.targetUniversityIds() : List.of();
        List<String> skills = normalizeSkills(req.requiredSkills());

        Opportunity.WorkMode workMode = Opportunity.WorkMode.fromDb(req.workplaceType().trim());
        Opportunity.WorkType workType = Opportunity.WorkType.valueOf(req.workType().trim().toUpperCase());

        String opportunityType = blankToNull(req.type());
        if (opportunityType == null) {
            opportunityType = "GENERAL";
        }

        String code = "O-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        int positions = req.positionCount() != null && req.positionCount() > 0 ? req.positionCount() : 1;

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("company_id", companyId);
        row.put("code", code);
        row.put("title", req.title().trim());
        row.put("description", req.description().trim());
        row.put("required_skills", OpportunityMapper.skillsToCsv(skills));
        row.put("required_experience", req.requirements().trim());
        row.put("deadline", req.deadline().toString());
        row.put("start_date", req.startDate() != null ? req.startDate().toString() : null);
        row.put("type", opportunityType);
        row.put("position_count", positions);
        row.put("job_location", req.jobLocation().trim());
        row.put("work_mode", workMode.toDbValue());
        row.put("work_type", workType.name());
        row.put("duration", req.duration().trim());
        row.put("is_paid", req.paid());
        row.put("salary_monthly", Boolean.TRUE.equals(req.paid()) ? req.salaryMonthly() : null);
        row.put("nice_to_have", blankToNull(req.niceToHave()));
        row.put("is_draft", Boolean.TRUE.equals(req.draft()));
        row.put("created_at", Instant.now().toString());

        int newId = -1;
        try {
            newId = writeRepository.insertOpportunityRow(row);
            writeRepository.replaceTargetUniversities(newId, targets);
        } catch (IllegalStateException e) {
            if (newId > 0) {
                try {
                    writeRepository.deleteOpportunity(newId, companyId);
                } catch (IllegalStateException ignored) {
                    /* best-effort rollback */
                }
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }

        Opportunity created = opportunityRepository.findByIdAndCompanyId(newId, companyId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Opportunity was created but could not be reloaded."
                ));
        return new CompanyOpportunityDetailResponse(toItem(created), emptyStats());
    }

    public CompanyOpportunityDetailResponse update(UserAccount user, int opportunityId, CompanyOpportunityUpdateRequest req) {
        requireCompany(user);
        int companyId = parseCompanyId(user);

        if (opportunityRepository.findByIdAndCompanyId(opportunityId, companyId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found");
        }

        validateUpdate(req);

        Map<String, Object> patch = new LinkedHashMap<>();
        if (req.title() != null) {
            patch.put("title", req.title().trim());
        }
        if (req.description() != null) {
            patch.put("description", req.description().trim());
        }
        if (req.requiredSkills() != null) {
            List<String> skills = normalizeSkills(req.requiredSkills());
            if (skills.isEmpty()) {
                throw new ValidationException(Map.of("requiredSkills", "At least one skill is required."));
            }
            patch.put("required_skills", OpportunityMapper.skillsToCsv(skills));
        }
        if (req.requirements() != null) {
            patch.put("required_experience", req.requirements().trim());
        }
        if (req.deadline() != null) {
            validateDeadline(req.deadline());
            patch.put("deadline", req.deadline().toString());
        }
        if (req.startDate() != null) {
            patch.put("start_date", req.startDate().toString());
        }
        if (req.type() != null) {
            if (req.type().isBlank()) {
                throw new ValidationException(Map.of("type", "Type cannot be blank when provided."));
            }
            patch.put("type", req.type().trim());
        }
        if (req.positionCount() != null) {
            if (req.positionCount() < 1) {
                throw new ValidationException(Map.of("positionCount", "Must be at least 1."));
            }
            patch.put("position_count", req.positionCount());
        }
        if (req.jobLocation() != null) {
            patch.put("job_location", req.jobLocation().trim());
        }
        if (req.workplaceType() != null && !req.workplaceType().isBlank()) {
            Opportunity.WorkMode wm = Opportunity.WorkMode.fromDb(req.workplaceType().trim());
            if (wm == null) {
                throw new ValidationException(Map.of("workplaceType", "Must be Remote, Hybrid, or On-site."));
            }
            patch.put("work_mode", wm.toDbValue());
        }
        if (req.workType() != null && !req.workType().isBlank()) {
            try {
                Opportunity.WorkType wt = Opportunity.WorkType.valueOf(req.workType().trim().toUpperCase());
                patch.put("work_type", wt.name());
            } catch (IllegalArgumentException e) {
                throw new ValidationException(Map.of("workType", "Must be FULL_TIME or PART_TIME."));
            }
        }
        if (req.duration() != null) {
            patch.put("duration", req.duration().trim());
        }
        if (req.paid() != null) {
            patch.put("is_paid", req.paid());
            if (!Boolean.TRUE.equals(req.paid())) {
                patch.put("salary_monthly", null);
            }
        }
        if (req.salaryMonthly() != null) {
            patch.put("salary_monthly", req.salaryMonthly());
        }
        if (req.niceToHave() != null) {
            patch.put("nice_to_have", blankToNull(req.niceToHave()));
        }
        if (req.draft() != null) {
            patch.put("is_draft", req.draft());
        }

        try {
            if (!patch.isEmpty()) {
                writeRepository.patchOpportunity(opportunityId, companyId, patch);
            }
            if (req.targetUniversityIds() != null) {
                writeRepository.replaceTargetUniversities(opportunityId, req.targetUniversityIds());
            }
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }

        Opportunity updated = opportunityRepository.findByIdAndCompanyId(opportunityId, companyId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Opportunity could not be reloaded after update."
                ));
        return new CompanyOpportunityDetailResponse(toItem(updated), emptyStats());
    }

    public void delete(UserAccount user, int opportunityId) {
        requireCompany(user);
        int companyId = parseCompanyId(user);
        if (opportunityRepository.findByIdAndCompanyId(opportunityId, companyId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found");
        }
        try {
            writeRepository.deleteOpportunity(opportunityId, companyId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    private static OpportunityApplicationStatsDto emptyStats() {
        return new OpportunityApplicationStatsDto(0, 0, 0, 0);
    }

    private static void requireCompany(UserAccount user) {
        if (user == null || user.getRole() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != Role.COMPANY) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only company accounts can manage opportunities.");
        }
    }

    private static int parseCompanyId(UserAccount user) {
        try {
            return Integer.parseInt(user.getLinkedEntityId().trim());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Account linked_entity_id must be a numeric company id"
            );
        }
    }

    private void validateCreate(CompanyOpportunityCreateRequest req) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (req == null) {
            throw new ValidationException(Map.of("_request", "Request body is required."));
        }
        if (req.title() == null || req.title().isBlank()) {
            errors.put("title", "Title is required.");
        }
        if (req.description() == null || req.description().isBlank()) {
            errors.put("description", "Description is required.");
        }
        if (req.requirements() == null || req.requirements().isBlank()) {
            errors.put("requirements", "Requirements are required.");
        }
        if (req.deadline() == null) {
            errors.put("deadline", "Deadline is required.");
        } else {
            validateDeadline(req.deadline(), errors);
        }
        if (req.startDate() == null) {
            errors.put("startDate", "Start date is required.");
        } else {
            validateStartDate(req.startDate(), errors);
        }
        if (req.requiredSkills() == null || req.requiredSkills().isEmpty()) {
            errors.put("requiredSkills", "At least one required skill is required.");
        } else {
            List<String> skills = normalizeSkills(req.requiredSkills());
            if (skills.isEmpty()) {
                errors.put("requiredSkills", "At least one non-empty skill is required.");
            }
        }
        if (req.targetUniversityIds() == null) {
            errors.put("targetUniversityIds", "targetUniversityIds is required (use an empty array for all universities).");
        }
        if (req.positionCount() != null && req.positionCount() < 1) {
            errors.put("positionCount", "Must be at least 1.");
        }
        if (req.jobLocation() == null || req.jobLocation().isBlank()) {
            errors.put("jobLocation", "Location is required.");
        }
        if (req.workplaceType() == null || req.workplaceType().isBlank()) {
            errors.put("workplaceType", "Workplace type is required.");
        } else if (Opportunity.WorkMode.fromDb(req.workplaceType().trim()) == null) {
            errors.put("workplaceType", "Must be Remote, Hybrid, or On-site.");
        }
        if (req.workType() == null || req.workType().isBlank()) {
            errors.put("workType", "Work type is required.");
        } else {
            try {
                Opportunity.WorkType.valueOf(req.workType().trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                errors.put("workType", "Must be FULL_TIME or PART_TIME.");
            }
        }
        if (req.duration() == null || req.duration().isBlank()) {
            errors.put("duration", "Duration is required.");
        }
        if (req.paid() == null) {
            errors.put("paid", "Paid status is required.");
        }
        if (req.type() != null && req.type().length() > 200) {
            errors.put("type", "Type must be at most 200 characters.");
        }
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    private void validateUpdate(CompanyOpportunityUpdateRequest req) {
        if (req == null) {
            throw new ValidationException(Map.of("_request", "Request body is required."));
        }
        boolean any = req.title() != null
                || req.description() != null
                || req.requiredSkills() != null
                || req.requirements() != null
                || req.deadline() != null
                || req.startDate() != null
                || req.targetUniversityIds() != null
                || req.type() != null
                || req.positionCount() != null
                || req.jobLocation() != null
                || req.workplaceType() != null
                || req.workType() != null
                || req.duration() != null
                || req.paid() != null
                || req.salaryMonthly() != null
                || req.niceToHave() != null
                || req.draft() != null;
        if (!any) {
            throw new ValidationException(Map.of("_request", "Provide at least one field to update."));
        }

        Map<String, String> errors = new LinkedHashMap<>();
        if (req.title() != null && req.title().isBlank()) {
            errors.put("title", "Title cannot be blank.");
        }
        if (req.description() != null && req.description().isBlank()) {
            errors.put("description", "Description cannot be blank.");
        }
        if (req.requirements() != null && req.requirements().isBlank()) {
            errors.put("requirements", "Requirements cannot be blank.");
        }
        if (req.deadline() != null) {
            validateDeadline(req.deadline(), errors);
        }
        if (req.startDate() != null) {
            validateStartDate(req.startDate(), errors);
        }
        if (req.requiredSkills() != null) {
            List<String> skills = normalizeSkills(req.requiredSkills());
            if (skills.isEmpty()) {
                errors.put("requiredSkills", "At least one skill is required when updating skills.");
            }
        }
        if (req.type() != null && req.type().length() > 200) {
            errors.put("type", "Type must be at most 200 characters.");
        }
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    private static void validateDeadline(LocalDate deadline) {
        Map<String, String> errors = new LinkedHashMap<>();
        validateDeadline(deadline, errors);
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    private static void validateDeadline(LocalDate deadline, Map<String, String> errors) {
        if (deadline.isBefore(LocalDate.now())) {
            errors.put("deadline", "Deadline cannot be in the past.");
        }
    }

    private static void validateStartDate(LocalDate startDate, Map<String, String> errors) {
        if (startDate != null && startDate.isBefore(LocalDate.now())) {
            errors.put("startDate", "Start date cannot be in the past.");
        }
    }

    private static List<String> normalizeSkills(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String s : raw) {
            if (s != null && !s.isBlank()) {
                out.add(s.trim());
            }
        }
        return out;
    }

    private static String blankToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }

    private static List<Integer> targetUniversityIds(Opportunity o) {
        if (o.targetUniversities() == null) {
            return List.of();
        }
        return o.targetUniversities().stream().map(TargetUniversity::id).toList();
    }

    private static List<TargetUniversityOption> targetUniversityOptions(Opportunity o) {
        if (o.targetUniversities() == null || o.targetUniversities().isEmpty()) {
            return List.of();
        }
        return o.targetUniversities().stream()
                .map(t -> new TargetUniversityOption(
                        t.id(),
                        t.name() != null && !t.name().isBlank() ? t.name() : ("University " + t.id())))
                .toList();
    }

    private static OpportunityResponseItem toItem(Opportunity o) {
        String typeStr = o.type();
        String wm = o.workMode() == null ? null : o.workMode().toApiValue();
        String wt = o.workType();
        int skillMatchCount = 0;
        return new OpportunityResponseItem(
                o.id(),
                o.companyId(),
                o.companyName(),
                o.title(),
                o.description(),
                o.requiredSkills(),
                o.requiredExperience(),
                o.deadline(),
                o.startDate(),
                targetUniversityIds(o),
                targetUniversityOptions(o),
                typeStr,
                o.location(),
                o.isPaid(),
                wm,
                o.positionCount(),
                wt,
                o.duration(),
                o.salaryMonthly(),
                o.niceToHave(),
                o.draft(),
                o.postedAt(),
                skillMatchCount,
                o.code(),
                o.createdAt(),
                0);
    }
}
