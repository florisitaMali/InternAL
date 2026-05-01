package com.internaal.controller;

import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.ApplicationResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.PpaService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ppa")
public class PpaController {

    private final PpaService ppaService;

    public PpaController(PpaService ppaService) {
        this.ppaService = ppaService;
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('PPA')")
    public AdminPpaResponse me(@AuthenticationPrincipal UserAccount user) {
        return ppaService.getMyProfile(user);
    }

    @GetMapping("/applications")
    public List<ApplicationResponse> applications(@AuthenticationPrincipal UserAccount user) {
        return ppaService.listApplications(user);
    }

    @GetMapping("/students")
    public List<AdminStudentResponse> students(@AuthenticationPrincipal UserAccount user) {
        return ppaService.listStudents(user);
    }
}
