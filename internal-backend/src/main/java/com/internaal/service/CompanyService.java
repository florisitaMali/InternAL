package com.internaal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.internaal.dto.CompanyOpportunityDetailResponse;
import com.internaal.dto.CompanyProfileResponse;
import com.internaal.dto.CompanyProfileUpdateRequest;
import com.internaal.dto.OpportunityApplicationStatsDto;
import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.StudentOpportunitiesResponse;
import com.internaal.entity.Opportunity;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.repository.CompanyRepository;
import com.internaal.repository.OpportunityRepository;
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

    public CompanyService(CompanyRepository companyRepository, OpportunityRepository opportunityRepository) {
        this.companyRepository = companyRepository;
        this.opportunityRepository = opportunityRepository;
    }

    public CompanyProfileResponse getProfile(UserAccount user) {
        int companyId = requireCompanyId(user);
        String jwt = requireJwt();
        JsonNode node = companyRepository.findByCompanyId(companyId, jwt)
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
        List<Opportunity> rows = opportunityRepository.findForCompany(companyId);
        List<OpportunityResponseItem> items = rows.stream()
                .sorted(Comparator.comparing(Opportunity::title, String.CASE_INSENSITIVE_ORDER))
                .map(this::toItem)
                .collect(Collectors.toList());
        return new StudentOpportunitiesResponse(items);
    }

    public CompanyOpportunityDetailResponse getOpportunity(UserAccount user, Integer opportunityId) {
        int companyId = requireCompanyId(user);
        Opportunity o = opportunityRepository.findByIdAndCompany(opportunityId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Opportunity not found"));
        return new CompanyOpportunityDetailResponse(toItem(o), emptyStats());
    }

    private static OpportunityApplicationStatsDto emptyStats() {
        return new OpportunityApplicationStatsDto(0, 0, 0, 0);
    }

    private OpportunityResponseItem toItem(Opportunity o) {
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
                0,
                o.workType(),
                o.duration()
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
