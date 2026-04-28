package com.internaal.controller;

import com.internaal.dto.ApplicationRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.service.ApplicationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/student/applications")
public class ApplicationController {

    private final ApplicationService applicationService;

    public ApplicationController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @PostMapping
    public ResponseEntity<?> submitApplication(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody ApplicationRequest request) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        if (user.getRole() != Role.STUDENT) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        try {
            ApplicationResponse result = applicationService.submitApplication(
                    Integer.parseInt(user.getLinkedEntityId()), request);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getApplications(
            @AuthenticationPrincipal UserAccount user) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        if (user.getRole() != Role.STUDENT) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        try {
            List<ApplicationResponse> results = applicationService.getApplicationsByStudent(
                    Integer.parseInt(user.getLinkedEntityId()));
            return ResponseEntity.ok(results);
        } catch (RuntimeException e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}