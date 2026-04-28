package com.internaal.service;

import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.StudentOpportunitiesResponse;
import com.internaal.dto.TargetUniversityOption;
import com.internaal.entity.Opportunity;
import com.internaal.entity.TargetUniversity;
import com.internaal.entity.UserAccount;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.OpportunityRepository;
import com.internaal.repository.StudentProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StudentOpportunityService {

    private final StudentProfileRepository studentProfileRepository;
    private final OpportunityRepository opportunityRepository;
    private final ApplicationRepository applicationRepository;

    public StudentOpportunityService(
            StudentProfileRepository studentProfileRepository,
            OpportunityRepository opportunityRepository,
            ApplicationRepository applicationRepository) {
        this.studentProfileRepository = studentProfileRepository;
        this.opportunityRepository = opportunityRepository;
        this.applicationRepository = applicationRepository;
    }

    public StudentOpportunitiesResponse listForStudent(UserAccount user, OpportunityQuery query) {
        Integer studentId;
        try {
            studentId = Integer.valueOf(user.getLinkedEntityId());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Account linked_entity_id must be a numeric student id"
            );
        }
        Integer universityId = studentProfileRepository.findUniversityIdByStudentId(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student profile not found"));

        List<String> studentSkills = studentProfileRepository.findSkillsByStudentId(studentId);
        List<Opportunity> rows = opportunityRepository.findForStudent(universityId, query);

        List<Integer> opportunityIds = rows.stream()
                .map(Opportunity::id)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Integer, Integer> applicantCounts = applicationRepository.countApplicationsByOpportunityIds(opportunityIds);

        List<OpportunityResponseItem> items = rows.stream()
                .sorted(Comparator
                        .comparingInt((Opportunity o) -> -skillMatchCount(o, studentSkills))
                        .thenComparing(o -> o.deadline() != null ? o.deadline() : LocalDate.MAX)
                        .thenComparing(Opportunity::title, String.CASE_INSENSITIVE_ORDER))
                .map(o -> toDto(o, studentSkills, applicantCounts.getOrDefault(o.id(), 0)))
                .collect(Collectors.toList());

        return new StudentOpportunitiesResponse(items);
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

     
    private static OpportunityResponseItem toDto(Opportunity o, List<String> studentSkills, int applicantCount) {
        int matches = skillMatchCount(o, studentSkills);
        String typeStr = resolveTypeDisplay(o);
        String wm = o.workMode() == null ? null : o.workMode().toApiValue();
        String wt = o.workType();
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
                matches,
                o.code(),
                o.createdAt(),
                applicantCount
        );
    }

    private static String resolveTypeDisplay(Opportunity o) {
        if (o.typeRaw() != null && !o.typeRaw().isBlank()) {
            return o.typeRaw().trim();
        }
        return o.type();
    }

    /**
     * Counts how many of the opportunity's required skills appear in the student's skill set (case-insensitive).
     */
    static int skillMatchCount(Opportunity o, List<String> studentSkills) {
        if (studentSkills == null || studentSkills.isEmpty() || o.requiredSkills() == null) {
            return 0;
        }
        Set<String> lowerStudent = studentSkills.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        if (lowerStudent.isEmpty()) {
            return 0;
        }
        return (int) o.requiredSkills().stream()
                .filter(req -> req != null && lowerStudent.contains(req.toLowerCase(Locale.ROOT)))
                .count();
    }
}
