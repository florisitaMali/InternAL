package com.internaal.controller;

import com.internaal.dto.InstitutionalPartnershipRespondRequest;
import com.internaal.dto.InstitutionalPartnershipUniversitiesResponse;
import com.internaal.dto.UniversityProfileResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.InstitutionalPartnershipService;
import com.internaal.service.UniversityAdminService;
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
@RequestMapping("/api/company/partnerships")
public class CompanyPartnershipController {

    private final InstitutionalPartnershipService institutionalPartnershipService;
    private final UniversityAdminService universityAdminService;

    public CompanyPartnershipController(
            InstitutionalPartnershipService institutionalPartnershipService,
            UniversityAdminService universityAdminService) {
        this.institutionalPartnershipService = institutionalPartnershipService;
        this.universityAdminService = universityAdminService;
    }

    @GetMapping("/universities")
    public InstitutionalPartnershipUniversitiesResponse listUniversities(@AuthenticationPrincipal UserAccount user) {
        return institutionalPartnershipService.listUniversitiesForCompany(user);
    }

    @GetMapping("/universities/{universityId}/profile")
    public UniversityProfileResponse universityProfile(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("universityId") int universityId) {
        return universityAdminService.getUniversityProfileForCompany(user, universityId);
    }

    @PostMapping("/universities/{universityId}/request")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void request(@AuthenticationPrincipal UserAccount user, @PathVariable("universityId") int universityId) {
        institutionalPartnershipService.requestPartnershipAsCompany(user, universityId);
    }

    @PostMapping("/universities/{universityId}/respond")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void respond(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("universityId") int universityId,
            @RequestBody InstitutionalPartnershipRespondRequest body
    ) {
        if (body == null) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Body required");
        }
        institutionalPartnershipService.respondAsCompany(user, universityId, body.approve());
    }

    @DeleteMapping("/universities/{universityId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void end(@AuthenticationPrincipal UserAccount user, @PathVariable("universityId") int universityId) {
        institutionalPartnershipService.endPartnershipAsCompany(user, universityId);
    }
}
