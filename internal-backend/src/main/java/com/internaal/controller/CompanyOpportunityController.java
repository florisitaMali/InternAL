package com.internaal.controller;

import com.internaal.dto.CompanyOpportunitiesResponse;
import com.internaal.dto.CompanyOpportunityCreateRequest;
import com.internaal.dto.CompanyOpportunityDetailResponse;
import com.internaal.dto.CompanyOpportunityUpdateRequest;
import com.internaal.dto.TargetUniversitiesResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.CompanyOpportunityService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/company")
public class CompanyOpportunityController {

    private final CompanyOpportunityService companyOpportunityService;

    public CompanyOpportunityController(CompanyOpportunityService companyOpportunityService) {
        this.companyOpportunityService = companyOpportunityService;
    }

    @GetMapping("/opportunities")
    public CompanyOpportunitiesResponse list(@AuthenticationPrincipal UserAccount user) {
        return companyOpportunityService.list(user);
    }

    @GetMapping("/target-universities")
    public TargetUniversitiesResponse listTargetUniversities(@AuthenticationPrincipal UserAccount user) {
        return companyOpportunityService.listTargetUniversities(user);
    }

    @GetMapping("/opportunities/{id}")
    public CompanyOpportunityDetailResponse get(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("id") int id
    ) {
        return companyOpportunityService.getById(user, id);
    }

    @PostMapping("/opportunities")
    @ResponseStatus(HttpStatus.CREATED)
    public CompanyOpportunityDetailResponse create(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody CompanyOpportunityCreateRequest body
    ) {
        return companyOpportunityService.create(user, body);
    }

    @PutMapping("/opportunities/{id}")
    public CompanyOpportunityDetailResponse update(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("id") int id,
            @RequestBody CompanyOpportunityUpdateRequest body
    ) {
        return companyOpportunityService.update(user, id, body);
    }

    @DeleteMapping("/opportunities/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("id") int id
    ) {
        companyOpportunityService.delete(user, id);
    }
}
