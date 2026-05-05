package com.internaal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.internaal.dto.CompanyOpportunityDetailResponse;
import com.internaal.dto.OpportunityApplicationStatsDto;
import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.StudentOpportunitiesResponse;
import com.internaal.dto.CompanyProfileResponse;
import com.internaal.dto.CompanyProfileUpdateRequest;
import com.internaal.entity.Role;
import com.internaal.entity.Opportunity;
import com.internaal.entity.UserAccount;
import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.StudentFileDownload;
import com.internaal.dto.StudentProfileResponse;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.CompanyRepository;
import com.internaal.repository.OpportunityRepository;
import com.internaal.repository.StudentProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final OpportunityRepository opportunityRepository;
    private final ApplicationRepository applicationRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final StudentProfileFileService studentProfileFileService;

    public CompanyService(
            CompanyRepository companyRepository,
            OpportunityRepository opportunityRepository,
            ApplicationRepository applicationRepository,
            StudentProfileRepository studentProfileRepository,
            StudentProfileFileService studentProfileFileService) {
        this.companyRepository = companyRepository;
        this.opportunityRepository = opportunityRepository;
        this.applicationRepository = applicationRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.studentProfileFileService = studentProfileFileService;
    }

    public CompanyProfileResponse getProfile(UserAccount user) {
        int companyId = requireCompanyId(user);
        String jwt = requireJwt();
        JsonNode node = companyRepository.findByCompanyId(companyId, jwt)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));
        return mapCompany(node, companyId);
    }

    public CompanyProfileResponse getProfileForStudent(UserAccount user, int companyId) {
        if (user == null || user.getRole() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != Role.STUDENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student access required");
        }
        String jwt = requireJwt();
        JsonNode node = companyRepository.findByCompanyIdReadable(companyId, jwt)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));
        return mapCompany(node, companyId);
    }

    public CompanyProfileResponse updateProfile(UserAccount user, CompanyProfileUpdateRequest req) {
        int companyId = requireCompanyId(user);
        String jwt = requireJwt();
        if (req.name() != null && req.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name cannot be blank");
        }
        if (req.foundedYear() != null && (req.foundedYear() < 1800 || req.foundedYear() > 2100)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid founded year");
        }
        if (req.employeeCount() != null && req.employeeCount() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "employeeCount must be non-negative");
        }
        Map<String, Object> patch = CompanyRepository.toPatchMap(
                req.name(),
                req.location(),
                req.description(),
                req.website(),
                req.industry(),
                req.employeeCount(),
                req.foundedYear(),
                req.specialties(),
                req.logoUrl(),
                req.coverUrl()
        );
        JsonNode updated = companyRepository.patchCompany(companyId, jwt, patch)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Could not update company: no row was updated. Set SUPABASE_SERVICE_ROLE_KEY on the server, "
                                + "or add an RLS UPDATE policy on `company`. Ensure linked_entity_id matches company.company_id (or id)."
                ));
        return mapCompany(updated, companyId);
    }

    public StudentOpportunitiesResponse listOpportunities(UserAccount user) {
        int companyId = requireCompanyId(user);
        List<Opportunity> rows = opportunityRepository.findForCompanyId(companyId);
        List<OpportunityResponseItem> items = rows.stream()
                .sorted(Comparator.comparing(Opportunity::title, String.CASE_INSENSITIVE_ORDER))
                .map(this::toItem)
                .collect(Collectors.toList());
        return new StudentOpportunitiesResponse(items);
    }

    public CompanyOpportunityDetailResponse getOpportunity(UserAccount user, Integer opportunityId) {
        int companyId = requireCompanyId(user);
        Opportunity o = opportunityRepository.findByIdAndCompanyId(opportunityId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found"));
        return new CompanyOpportunityDetailResponse(toItem(o), statsForOpportunity(companyId, opportunityId));
    }

    public List<ApplicationResponse> listApplications(UserAccount user) {
        int companyId = requireCompanyId(user);
        return applicationRepository.findByCompanyId(companyId);
    }

    /**
     * Approves or rejects an application on behalf of the company. Verifies ownership and that the
     * application hasn't already been decided before mutating.
     */
    public ApplicationResponse decideApplication(UserAccount user, int applicationId, boolean approved) {
        int companyId = requireCompanyId(user);
        JsonNode row = applicationRepository.findApplicationOwnership(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found."));
        JsonNode companyNode = row.get("company_id");
        Integer rowCompanyId = (companyNode == null || companyNode.isNull()) ? null : companyNode.asInt();
        if (rowCompanyId == null || rowCompanyId != companyId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Application does not belong to this company.");
        }
        JsonNode decisionNode = row.get("is_approved_by_company");
        if (decisionNode != null && !decisionNode.isNull()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This application has already been decided.");
        }
        return applicationRepository.setCompanyDecision(applicationId, approved)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Could not update the application. Please try again."));
    }

    /**
     * Returns the read-only profile of a student who has applied to one of the company's
     * opportunities. Authorization rule: any student that has any application for this company
     * can be viewed (regardless of approval state).
     */
    public StudentProfileResponse getStudentProfile(UserAccount user, int studentId) {
        int companyId = requireCompanyId(user);
        if (!applicationRepository.studentHasAppliedToCompany(studentId, companyId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This student has not applied to your opportunities.");
        }
        return studentProfileRepository.findByStudentIdAsService(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Student profile not found."));
    }

    /** Streams a student's CV to the company. Same authorization rule as {@link #getStudentProfile}. */
    public StudentFileDownload downloadStudentCv(UserAccount user, int studentId) {
        requireStudentApplicationOwnership(user, studentId);
        try {
            return studentProfileFileService.downloadCv(studentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV not found."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not download CV.");
        }
    }

    /** Streams one of a student's certifications to the company. */
    public StudentFileDownload downloadStudentCertification(UserAccount user, int studentId, int certificationId) {
        requireStudentApplicationOwnership(user, studentId);
        try {
            return studentProfileFileService.downloadCertification(studentId, certificationId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Certification not found."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not download certification.");
        }
    }

    private void requireStudentApplicationOwnership(UserAccount user, int studentId) {
        int companyId = requireCompanyId(user);
        if (!applicationRepository.studentHasAppliedToCompany(studentId, companyId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This student has not applied to your opportunities.");
        }
    }

    private OpportunityApplicationStatsDto statsForOpportunity(int companyId, int opportunityId) {
        List<ApplicationResponse> apps = applicationRepository.findByCompanyId(companyId);
        int total = 0;
        int inReview = 0;
        int approved = 0;
        int rejected = 0;
        for (ApplicationResponse a : apps) {
            if (a.getOpportunityId() == null || a.getOpportunityId() != opportunityId) {
                continue;
            }
            total++;
            Boolean c = a.getIsApprovedByCompany();
            if (Boolean.TRUE.equals(c)) {
                approved++;
            } else if (Boolean.FALSE.equals(c)) {
                rejected++;
            } else {
                inReview++;
            }
        }
        return new OpportunityApplicationStatsDto(total, inReview, approved, rejected);
    }

    private static String resolveTypeDisplay(Opportunity o) {
        if (o.typeRaw() != null && !o.typeRaw().isBlank()) {
            return o.typeRaw().trim();
        }
        return o.type();
    }

    private OpportunityResponseItem toItem(Opportunity o) {
        String typeStr = resolveTypeDisplay(o);
        String wm = o.workMode() == null ? null : o.workMode().toApiValue();
        String wt = o.workType();
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
                List.of(),
                List.of(),
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
                0,
                o.code(),
                o.createdAt(),
                0
        );
    }

    private static CompanyProfileResponse mapCompany(JsonNode n, int fallbackCompanyId) {
        int id = fallbackCompanyId;
        if (n != null) {
            if (n.hasNonNull("company_id")) {
                id = n.get("company_id").asInt();
            } else if (n.hasNonNull("id")) {
                id = n.get("id").asInt();
            }
        }
        return new CompanyProfileResponse(
                id,
                text(n, "name"),
                text(n, "location"),
                text(n, "description"),
                text(n, "website"),
                text(n, "industry"),
                intOrNull(n, "employee_count"),
                intOrNull(n, "founded_year"),
                text(n, "specialties"),
                text(n, "logo_url"),
                text(n, "cover_url")
        );
    }

    private static String text(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        String s = n.get(field).asText();
        return s != null && s.isBlank() ? null : s;
    }

    private static Integer intOrNull(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        JsonNode v = n.get(field);
        if (v.isNumber()) {
            return v.isIntegralNumber() ? v.intValue() : (int) Math.round(v.doubleValue());
        }
        if (!v.isTextual()) {
            return null;
        }
        String t = v.asText().trim();
        if (t.isEmpty()) {
            return null;
        }
        return parseIntDigits(t);
    }

    private static Integer parseIntDigits(String t) {
        int sign = 1;
        int i = 0;
        char h = t.charAt(0);
        if (h == '-' || h == '+') {
            if (h == '-') {
                sign = -1;
            }
            i = 1;
            if (i >= t.length()) {
                return null;
            }
        }
        long acc = 0;
        for (; i < t.length(); i++) {
            char c = t.charAt(i);
            if (c < '0' || c > '9') {
                return null;
            }
            acc = acc * 10 + (c - '0');
            if (sign > 0 && acc > Integer.MAX_VALUE) {
                return null;
            }
            if (sign < 0 && acc > (long) Integer.MAX_VALUE + 1) {
                return null;
            }
        }
        return sign > 0 ? (int) acc : (int) -acc;
    }

    private static int requireCompanyId(UserAccount user) {
        if (user.getRole() != Role.COMPANY) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Company role required");
        }
        try {
            return Integer.parseInt(user.getLinkedEntityId());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "linked_entity_id must be a numeric company id");
        }
    }

    private static String requireJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getCredentials() instanceof String jwt) || jwt.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing token");
        }
        return jwt;
    }
}
