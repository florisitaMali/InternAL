package com.internaal.controller;

import com.internaal.dto.AdminCompanySummaryResponse;
import com.internaal.dto.AdminDashboardStatsResponse;
import com.internaal.dto.AdminDepartmentCreateRequest;
import com.internaal.dto.AdminDepartmentResponse;
import com.internaal.dto.AdminDepartmentUpdateRequest;
import com.internaal.dto.AdminOpportunitySummaryResponse;
import com.internaal.dto.OpportunityResponseItem;
import com.internaal.dto.AdminPpaCreateRequest;
import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminPpaUpdateRequest;
import com.internaal.dto.AdminStudentCreateRequest;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.AdminStudyFieldCreateRequest;
import com.internaal.dto.AdminStudyFieldResponse;
import com.internaal.dto.AdminStudyFieldUpdateRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.StudentFileDownload;
import com.internaal.dto.StudentProfileResponse;
import com.internaal.dto.UniversityProfileResponse;
import com.internaal.dto.UniversityProfileUpdateRequest;
import com.internaal.entity.UserAccount;
import com.internaal.service.StudentProfileFileService;
import com.internaal.service.UniversityAdminService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
public class UniversityAdminController {

    private final UniversityAdminService universityAdminService;
    private final StudentProfileFileService studentProfileFileService;

    public UniversityAdminController(
            UniversityAdminService universityAdminService,
            StudentProfileFileService studentProfileFileService) {
        this.universityAdminService = universityAdminService;
        this.studentProfileFileService = studentProfileFileService;
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

    @PostMapping("/departments")
    public AdminDepartmentResponse createDepartment(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody AdminDepartmentCreateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return universityAdminService.createDepartment(user, body);
    }

    @PostMapping("/study-fields")
    public AdminStudyFieldResponse createStudyField(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody AdminStudyFieldCreateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return universityAdminService.createStudyField(user, body);
    }

    @PutMapping("/departments/{departmentId}")
    public AdminDepartmentResponse updateDepartment(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("departmentId") int departmentId,
            @RequestBody AdminDepartmentUpdateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return universityAdminService.updateDepartment(user, departmentId, body);
    }

    @DeleteMapping("/departments/{departmentId}")
    public void deleteDepartment(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("departmentId") int departmentId) {
        universityAdminService.deleteDepartment(user, departmentId);
    }

    @PutMapping("/study-fields/{fieldId}")
    public AdminStudyFieldResponse updateStudyField(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("fieldId") int fieldId,
            @RequestBody AdminStudyFieldUpdateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return universityAdminService.updateStudyField(user, fieldId, body);
    }

    @DeleteMapping("/study-fields/{fieldId}")
    public void deleteStudyField(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("fieldId") int fieldId) {
        universityAdminService.deleteStudyField(user, fieldId);
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

    @GetMapping("/university/profile")
    public UniversityProfileResponse universityProfile(@AuthenticationPrincipal UserAccount user) {
        return universityAdminService.getUniversityProfile(user);
    }

    @PutMapping("/university/profile")
    public UniversityProfileResponse updateUniversityProfile(
            @AuthenticationPrincipal UserAccount user,
            @RequestBody UniversityProfileUpdateRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        return universityAdminService.updateUniversityProfile(user, body);
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
            @RequestParam(name = "limit", defaultValue = "100") int limit,
            @RequestParam(name = "status", defaultValue = "all") String status) {
        return universityAdminService.listOpportunitySummaries(user, status, limit);
    }

    @GetMapping("/opportunities/{opportunityId}")
    public OpportunityResponseItem opportunityDetail(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("opportunityId") int opportunityId) {
        return universityAdminService.getOpportunityDetailForUniversity(user, opportunityId);
    }

    @GetMapping("/applications")
    public List<ApplicationResponse> applications(@AuthenticationPrincipal UserAccount user) {
        return universityAdminService.listAllApplications(user);
    }

    @GetMapping("/students/{studentId}/profile")
    public StudentProfileResponse studentProfile(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("studentId") int studentId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return universityAdminService.getStudentProfileForViewer(user, studentId);
    }

    @GetMapping("/students/{studentId}/profile/cv")
    public ResponseEntity<?> downloadStudentCv(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("studentId") int studentId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        universityAdminService.getStudentProfileForViewer(user, studentId);
        try {
            Optional<StudentFileDownload> file = studentProfileFileService.downloadCv(studentId);
            if (file.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "CV not found"));
            }
            return buildFileDownloadResponse(file.get());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Could not download CV"));
        }
    }

    @GetMapping("/students/{studentId}/profile/certifications/{certificationId}")
    public ResponseEntity<?> downloadStudentCertification(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("studentId") int studentId,
            @PathVariable("certificationId") Integer certificationId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        universityAdminService.getStudentProfileForViewer(user, studentId);
        try {
            Optional<StudentFileDownload> file =
                    studentProfileFileService.downloadCertification(studentId, certificationId);
            if (file.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Certification not found"));
            }
            return buildFileDownloadResponse(file.get());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Could not download certification"));
        }
    }

    private ResponseEntity<byte[]> buildFileDownloadResponse(StudentFileDownload file) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        file.getMimeType() == null || file.getMimeType().isBlank()
                                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                                : file.getMimeType()
                ))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.getFilename()).build().toString()
                )
                .body(file.getBytes());
    }
}
