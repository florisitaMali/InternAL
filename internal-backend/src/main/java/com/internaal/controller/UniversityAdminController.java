package com.internaal.controller;

import com.internaal.dto.AdminCompanySummaryResponse;
import com.internaal.dto.AdminDashboardStatsResponse;
import com.internaal.dto.AdminDepartmentResponse;
import com.internaal.dto.AdminOpportunitySummaryResponse;
import com.internaal.dto.AdminPpaCreateRequest;
import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminPpaUpdateRequest;
import com.internaal.dto.AdminStudentCreateRequest;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.AdminStudyFieldResponse;
import com.internaal.dto.ApplicationResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.UniversityAdminService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class UniversityAdminController {

    private final UniversityAdminService universityAdminService;

    public UniversityAdminController(UniversityAdminService universityAdminService) {
        this.universityAdminService = universityAdminService;
    }

    @GetMapping("/departments")
    public List<AdminDepartmentResponse> departments(@AuthenticationPrincipal UserAccount user) {
        return universityAdminService.listDepartments(user);
    }

    @GetMapping("/study-fields")
    public List<AdminStudyFieldResponse> studyFields(
            @AuthenticationPrincipal UserAccount user,
            @RequestParam(name = "departmentId", required = false) Integer departmentId) {
        return universityAdminService.listStudyFields(user, departmentId);
    }

    @GetMapping("/students")
    public List<AdminStudentResponse> students(@AuthenticationPrincipal UserAccount user) {
        return universityAdminService.listStudents(user);
    }

    @GetMapping("/ppas")
    public List<AdminPpaResponse> ppas(@AuthenticationPrincipal UserAccount user) {
        return universityAdminService.listPpas(user);
    }

    @PostMapping("/ppas")
    public AdminPpaResponse createPpa(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody AdminPpaCreateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return universityAdminService.createPpa(user, body);
    }

    @PutMapping("/ppas/{ppaId}")
    public AdminPpaResponse updatePpa(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("ppaId") int ppaId,
            @RequestBody AdminPpaUpdateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return universityAdminService.updatePpa(user, ppaId, body);
    }

    @DeleteMapping("/ppas/{ppaId}")
    public void deletePpa(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("ppaId") int ppaId) {
        universityAdminService.deletePpa(user, ppaId);
    }

    @PostMapping("/students")
    public AdminStudentResponse createStudent(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody AdminStudentCreateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return universityAdminService.createStudent(user, body);
    }

    @GetMapping("/dashboard/stats")
    public AdminDashboardStatsResponse stats(@AuthenticationPrincipal UserAccount user) {
        return universityAdminService.dashboardStats(user);
    }

    @GetMapping("/companies")
    public List<AdminCompanySummaryResponse> companies(
            @AuthenticationPrincipal UserAccount user,
            @RequestParam(name = "limit", defaultValue = "10") int limit) {
        return universityAdminService.listCompanies(user, limit);
    }

    @GetMapping("/opportunities")
    public List<AdminOpportunitySummaryResponse> opportunities(
            @AuthenticationPrincipal UserAccount user,
            @RequestParam(name = "limit", defaultValue = "100") int limit) {
        return universityAdminService.listOpportunitySummaries(user, limit);
    }

    @GetMapping("/applications")
    public List<ApplicationResponse> applications(@AuthenticationPrincipal UserAccount user) {
        return universityAdminService.listAllApplications(user);
    }
}
