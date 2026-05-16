package com.internaal.controller;

import com.internaal.dto.SystemAdminAnalyticsResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.SystemAdminAnalyticsService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sysadmin")
public class SystemAdminAnalyticsController {

    private final SystemAdminAnalyticsService service;

    public SystemAdminAnalyticsController(SystemAdminAnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/analytics")
    public SystemAdminAnalyticsResponse analytics(
            @AuthenticationPrincipal UserAccount user,
            @RequestParam(value = "universityId", required = false) Integer universityId,
            @RequestParam(value = "companyId", required = false) Integer companyId,
            @RequestParam(value = "granularity", required = false, defaultValue = "weekly") String granularity,
            @RequestParam(value = "range", required = false, defaultValue = "total") String range) {
        return service.analytics(user, universityId, companyId, granularity, range);
    }
}
