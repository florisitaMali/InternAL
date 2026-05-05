package com.internaal.controller;

import com.internaal.dto.AdminUniversityCreateRequest;
import com.internaal.dto.AdminUniversityListResponse;
import com.internaal.dto.AdminUniversityResponse;
import com.internaal.dto.AdminUniversityStatusRequest;
import com.internaal.dto.AdminUniversityUpdateRequest;
import com.internaal.entity.UserAccount;
import com.internaal.service.SystemAdminUniversityService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
public class SystemAdminUniversityController {

    private final SystemAdminUniversityService systemAdminUniversityService;

    public SystemAdminUniversityController(SystemAdminUniversityService systemAdminUniversityService) {
        this.systemAdminUniversityService = systemAdminUniversityService;
    }

    @GetMapping("/universities")
    public AdminUniversityListResponse list(@AuthenticationPrincipal UserAccount user) {
        return systemAdminUniversityService.listUniversities(user);
    }

    @PostMapping("/universities")
    public AdminUniversityResponse create(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody AdminUniversityCreateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return systemAdminUniversityService.createUniversity(user, body);
    }

    @PutMapping("/universities/{universityId}")
    public AdminUniversityResponse update(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("universityId") int universityId,
            @RequestBody AdminUniversityUpdateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return systemAdminUniversityService.updateUniversity(user, universityId, body);
    }

    @PatchMapping("/universities/{universityId}/status")
    public AdminUniversityResponse setStatus(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("universityId") int universityId,
            @RequestBody AdminUniversityStatusRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return systemAdminUniversityService.setStatus(user, universityId, body.isActive());
    }
}
