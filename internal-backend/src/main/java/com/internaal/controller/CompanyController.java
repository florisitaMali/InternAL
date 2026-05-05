package com.internaal.controller;

import com.internaal.dto.ApplicationDecisionRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.CompanyProfileResponse;
import com.internaal.dto.CompanyProfileUpdateRequest;
import com.internaal.entity.UserAccount;
import com.internaal.service.CompanyService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/company")
public class CompanyController {

    private final CompanyService companyService;

    public CompanyController(CompanyService companyService) {
        this.companyService = companyService;
    }

    @GetMapping("/profile")
    public CompanyProfileResponse getProfile(@AuthenticationPrincipal UserAccount user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return companyService.getProfile(user);
    }

    @PutMapping("/profile")
    public CompanyProfileResponse updateProfile(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody CompanyProfileUpdateRequest body) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return companyService.updateProfile(user, body);
    }

    @GetMapping("/applications")
    public List<ApplicationResponse> listApplications(@AuthenticationPrincipal UserAccount user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return companyService.listApplications(user);
    }

    @PatchMapping("/applications/{applicationId}")
    public ApplicationResponse patchApplicationDecision(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable int applicationId,
            @RequestBody ApplicationDecisionRequest body) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return companyService.updateApplicationDecision(user, applicationId, body);
    }
}
