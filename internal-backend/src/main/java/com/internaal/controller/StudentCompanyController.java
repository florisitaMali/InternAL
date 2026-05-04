package com.internaal.controller;

import com.internaal.dto.CompanyProfileResponse;
import com.internaal.dto.StudentOpportunitiesResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.CompanyService;
import com.internaal.service.StudentOpportunityService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/student/companies")
public class StudentCompanyController {

    private final CompanyService companyService;
    private final StudentOpportunityService studentOpportunityService;

    public StudentCompanyController(CompanyService companyService, StudentOpportunityService studentOpportunityService) {
        this.companyService = companyService;
        this.studentOpportunityService = studentOpportunityService;
    }

    @GetMapping("/{companyId}/profile")
    public CompanyProfileResponse getCompanyProfile(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable int companyId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return companyService.getProfileForStudent(user, companyId);
    }

    @GetMapping("/{companyId}/opportunities")
    public StudentOpportunitiesResponse listCompanyOpportunities(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable int companyId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return studentOpportunityService.listForStudentForCompany(user, companyId);
    }
}
