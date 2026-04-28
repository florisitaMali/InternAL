package com.internaal.controller;

import com.internaal.dto.StudentOpportunitiesResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.OpportunityQuery;
import com.internaal.service.StudentOpportunityService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/student")
public class StudentOpportunityController {

    private final StudentOpportunityService studentOpportunityService;

    public StudentOpportunityController(StudentOpportunityService studentOpportunityService) {
        this.studentOpportunityService = studentOpportunityService;
    }

    /**
     * Lists internship opportunities visible to the authenticated student, with optional search and filters.
     * Results are sorted by skill match count (desc), then deadline, then title.
     */
    @GetMapping("/opportunities")
    public StudentOpportunitiesResponse listOpportunities(
            @AuthenticationPrincipal UserAccount user,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> skills,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Boolean paid,
            @RequestParam(required = false) String workMode) {
        if (user == null || user.getRole() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != com.internaal.entity.Role.STUDENT
                && user.getRole() != com.internaal.entity.Role.UNIVERSITY_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student access required");
        }

        OpportunityQuery query = new OpportunityQuery(q, skills, normalizeTypeParam(type), location, paid, workMode);
        return studentOpportunityService.listForStudent(user, query);
    }

    private static String normalizeTypeParam(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        return type.trim();
    }
}
