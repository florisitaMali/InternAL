package com.internaal.service;

import com.internaal.dto.CompanyOpportunityDetailResponse;
import com.internaal.dto.OpportunityApplicationStatsDto;
import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.StudentOpportunitiesResponse;
import com.internaal.entity.Role;
import com.internaal.entity.Opportunity;
import com.internaal.entity.UserAccount;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.OpportunityMapper;
import com.internaal.repository.OpportunityRepository;
import com.internaal.repository.StudentProfileRepository;
import com.internaal.repository.UniversityAdminRepository;
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
    private final CompanyOpportunityService companyOpportunityService;
    private final UniversityAdminRepository universityAdminRepository;

    public StudentOpportunityService(
            StudentProfileRepository studentProfileRepository,
            OpportunityRepository opportunityRepository,
            ApplicationRepository applicationRepository,
            CompanyOpportunityService companyOpportunityService,
            UniversityAdminRepository universityAdminRepository) {
        this.studentProfileRepository = studentProfileRepository;
        this.opportunityRepository = opportunityRepository;
        this.applicationRepository = applicationRepository;
        this.companyOpportunityService = companyOpportunityService;
        this.universityAdminRepository = universityAdminRepository;
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
                .map(o -> OpportunityMapper.toResponseItem(
                        o, skillMatchCount(o, studentSkills), applicantCounts.getOrDefault(o.id(), 0)))
                .collect(Collectors.toList());

        return new StudentOpportunitiesResponse(items);
    }

    public CompanyOpportunityDetailResponse getOpportunityDetail(UserAccount user, int opportunityId) {
        if (user == null || user.getRole() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != Role.STUDENT && user.getRole() != Role.UNIVERSITY_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student access required");
        }
        int studentId;
        try {
            studentId = Integer.parseInt(user.getLinkedEntityId());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Account linked_entity_id must be a numeric student id"
            );
        }
        Integer universityId = studentProfileRepository.findUniversityIdByStudentId(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student profile not found"));

        Opportunity o = opportunityRepository.findVisibleForStudent(opportunityId, universityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found"));

        List<String> studentSkills = studentProfileRepository.findSkillsByStudentId(studentId);
        int match = skillMatchCount(o, studentSkills);
        OpportunityResponseItem item = companyOpportunityService.toResponseItem(o, match);
        return new CompanyOpportunityDetailResponse(
                item,
                new OpportunityApplicationStatsDto(0, 0, 0, 0)
        );
    }

    public StudentOpportunitiesResponse listForStudentForCompany(UserAccount user, int companyId) {
        if (user == null || user.getRole() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != Role.STUDENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student access required");
        }
        int studentId;
        try {
            studentId = Integer.parseInt(user.getLinkedEntityId());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Account linked_entity_id must be a numeric student id"
            );
        }
        Integer universityId = studentProfileRepository.findUniversityIdByStudentId(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student profile not found"));

        List<String> studentSkills = studentProfileRepository.findSkillsByStudentId(studentId);
        List<Opportunity> rows = opportunityRepository.findVisibleForStudentByCompany(companyId, universityId);

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
                .map(o -> OpportunityMapper.toResponseItem(
                        o, skillMatchCount(o, studentSkills), applicantCounts.getOrDefault(o.id(), 0)))
                .collect(Collectors.toList());

        return new StudentOpportunitiesResponse(items);
    }

    /**
     * Opportunities from {@code companyId} visible to the admin's institution (same rules as Explore), loaded with
     * the service role so PostgREST RLS does not block reads for university-admin JWTs.
     */
    public StudentOpportunitiesResponse listForUniversityAdminForCompany(UserAccount user, int companyId) {
        if (user == null || user.getRole() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != Role.UNIVERSITY_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "University admin access required");
        }
        if (companyId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid company");
        }
        int universityId;
        try {
            universityId = Integer.parseInt(user.getLinkedEntityId().trim());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "University admin is not linked to a university id");
        }

        List<Opportunity> rows =
                universityAdminRepository.listPublishedOpportunitiesForCompanyVisibleToUniversity(companyId, universityId);
        List<Integer> opportunityIds = rows.stream()
                .map(Opportunity::id)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Integer, Integer> applicantCounts = applicationRepository.countApplicationsByOpportunityIds(opportunityIds);

        List<OpportunityResponseItem> items = rows.stream()
                .sorted(Comparator
                        .comparing((Opportunity o) -> o.deadline() != null ? o.deadline() : LocalDate.MAX)
                        .thenComparing(Opportunity::title, String.CASE_INSENSITIVE_ORDER))
                .map(o -> OpportunityMapper.toResponseItem(
                        o, 0, applicantCounts.getOrDefault(o.id(), 0)))
                .collect(Collectors.toList());
        return new StudentOpportunitiesResponse(items);
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
