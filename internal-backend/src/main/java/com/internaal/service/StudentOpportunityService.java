package com.internaal.service;

import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.StudentOpportunitiesResponse;
import com.internaal.entity.Opportunity;
import com.internaal.entity.UserAccount;
import com.internaal.repository.OpportunityRepository;
import com.internaal.repository.StudentProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StudentOpportunityService {

    private final StudentProfileRepository studentProfileRepository;
    private final OpportunityRepository opportunityRepository;

    public StudentOpportunityService(
            StudentProfileRepository studentProfileRepository,
            OpportunityRepository opportunityRepository) {
        this.studentProfileRepository = studentProfileRepository;
        this.opportunityRepository = opportunityRepository;
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

        List<OpportunityResponseItem> items = rows.stream()
                .sorted(Comparator
                        .comparingInt((Opportunity o) -> -skillMatchCount(o, studentSkills))
                        .thenComparing(o -> o.deadline() != null ? o.deadline() : LocalDate.MAX)
                        .thenComparing(Opportunity::title, String.CASE_INSENSITIVE_ORDER))
                .map(o -> toDto(o, studentSkills))
                .collect(Collectors.toList());

        return new StudentOpportunitiesResponse(items);
    }

    private static OpportunityResponseItem toDto(Opportunity o, List<String> studentSkills) {
        int matches = skillMatchCount(o, studentSkills);
        String typeStr = o.type() == null ? null : o.type().name();
        String wm = o.workMode() == null ? null : o.workMode().toApiValue();
        return new OpportunityResponseItem(
                o.id(),
                o.companyId(),
                o.companyName(),
                o.title(),
                o.description(),
                o.requiredSkills(),
                o.requiredExperience(),
                o.deadline(),
                o.targetUniversityIds(),
                typeStr,
                o.location(),
                o.isPaid(),
                wm,
                matches,
                o.workType(),
                o.duration()
        );
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
