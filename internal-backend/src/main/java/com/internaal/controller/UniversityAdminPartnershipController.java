package com.internaal.controller;

import com.internaal.dto.CompanyProfileResponse;
import com.internaal.dto.InstitutionalPartnershipCompaniesResponse;
import com.internaal.dto.InstitutionalPartnershipRespondRequest;
import com.internaal.dto.StudentOpportunitiesResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.CompanyService;
import com.internaal.service.InstitutionalPartnershipService;
import com.internaal.service.StudentOpportunityService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/partnerships")
public class UniversityAdminPartnershipController {

    private final InstitutionalPartnershipService institutionalPartnershipService;
    private final CompanyService companyService;
    private final StudentOpportunityService studentOpportunityService;

    public UniversityAdminPartnershipController(
            InstitutionalPartnershipService institutionalPartnershipService,
            CompanyService companyService,
            StudentOpportunityService studentOpportunityService) {
        this.institutionalPartnershipService = institutionalPartnershipService;
        this.companyService = companyService;
        this.studentOpportunityService = studentOpportunityService;
    }

    @GetMapping("/companies")
    public InstitutionalPartnershipCompaniesResponse listCompanies(@AuthenticationPrincipal UserAccount user) {
        return institutionalPartnershipService.listCompaniesForUniversity(user);
    }

    @GetMapping("/companies/{companyId}/profile")
    public CompanyProfileResponse companyProfile(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("companyId") int companyId) {
        return companyService.getProfileForUniversityAdmin(user, companyId);
    }

    @GetMapping("/companies/{companyId}/opportunities")
    public StudentOpportunitiesResponse companyOpportunities(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("companyId") int companyId) {
        return studentOpportunityService.listForUniversityAdminForCompany(user, companyId);
    }

    @PostMapping("/companies/{companyId}/request")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void request(@AuthenticationPrincipal UserAccount user, @PathVariable("companyId") int companyId) {
        institutionalPartnershipService.requestPartnershipAsUniversity(user, companyId);
    }

    @PostMapping("/companies/{companyId}/respond")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void respond(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("companyId") int companyId,
            @RequestBody InstitutionalPartnershipRespondRequest body
    ) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        institutionalPartnershipService.respondAsUniversity(user, companyId, body.approve());
    }

    @DeleteMapping("/companies/{companyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void end(@AuthenticationPrincipal UserAccount user, @PathVariable("companyId") int companyId) {
        institutionalPartnershipService.endPartnershipAsUniversity(user, companyId);
    }
}
