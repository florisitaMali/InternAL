package com.internaal.controller;

import com.internaal.dto.AdminCompanyCreateRequest;
import com.internaal.dto.AdminCompanyListResponse;
import com.internaal.dto.AdminCompanyResponse;
import com.internaal.dto.AdminCompanyStatusRequest;
import com.internaal.dto.AdminCompanyUpdateRequest;
import com.internaal.entity.UserAccount;
import com.internaal.service.SystemAdminCompanyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/sysadmin")
public class SystemAdminCompanyController {

    private final SystemAdminCompanyService systemAdminCompanyService;

    public SystemAdminCompanyController(SystemAdminCompanyService systemAdminCompanyService) {
        this.systemAdminCompanyService = systemAdminCompanyService;
    }

    @GetMapping("/companies")
    public AdminCompanyListResponse list(@AuthenticationPrincipal UserAccount user) {
        return systemAdminCompanyService.listCompanies(user);
    }

    @PostMapping("/companies")
    public AdminCompanyResponse create(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody AdminCompanyCreateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return systemAdminCompanyService.createCompany(user, body);
    }

    @PutMapping("/companies/{companyId}")
    public AdminCompanyResponse update(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("companyId") int companyId,
            @RequestBody AdminCompanyUpdateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return systemAdminCompanyService.updateCompany(user, companyId, body);
    }

    @PatchMapping("/companies/{companyId}/status")
    public AdminCompanyResponse setStatus(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("companyId") int companyId,
            @RequestBody AdminCompanyStatusRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return systemAdminCompanyService.setStatus(user, companyId, body.isActive());
    }

    @DeleteMapping("/companies/{companyId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("companyId") int companyId) {
        systemAdminCompanyService.deleteCompany(user, companyId);
        return ResponseEntity.noContent().build();
    }
}
