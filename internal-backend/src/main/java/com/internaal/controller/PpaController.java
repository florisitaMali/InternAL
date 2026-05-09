package com.internaal.controller;

import com.internaal.dto.AdminPpaResponse;
import com.internaal.dto.AdminStudentResponse;
import com.internaal.dto.ApplicationDecisionRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.CompanyOpportunityDetailResponse;
import com.internaal.dto.StudentFileDownload;
import com.internaal.dto.StudentProfileResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.PpaService;
import com.internaal.service.StudentProfileFileService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/ppa")
public class PpaController {

    private final PpaService ppaService;
    private final StudentProfileFileService studentProfileFileService;

    public PpaController(PpaService ppaService, StudentProfileFileService studentProfileFileService) {
        this.ppaService = ppaService;
        this.studentProfileFileService = studentProfileFileService;
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

    @PatchMapping("/applications/{applicationId}")
    public ApplicationResponse patchApplicationDecision(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable int applicationId,
            @RequestBody ApplicationDecisionRequest body) {
        return ppaService.updateApplicationDecision(user, applicationId, body);
    }

    @GetMapping("/opportunities/{opportunityId}")
    public CompanyOpportunityDetailResponse ppaOpportunityDetail(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("opportunityId") int opportunityId) {
        return ppaService.getOpportunityDetailForPpa(user, opportunityId);
    }

    @GetMapping("/students")
    public List<AdminStudentResponse> students(@AuthenticationPrincipal UserAccount user) {
        return ppaService.listStudents(user);
    }

    @PreAuthorize("hasRole('PPA')")
    @GetMapping("/my-students")
    public List<AdminStudentResponse> myStudents(@AuthenticationPrincipal UserAccount user) {
        return ppaService.listStudentsByField(user);
    }

    @GetMapping("/students/{studentId}/profile")
    public StudentProfileResponse studentProfile(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("studentId") int studentId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ppaService.getStudentProfileForViewer(user, studentId);
    }

    @GetMapping("/students/{studentId}/profile/cv")
    public ResponseEntity<?> downloadStudentCv(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("studentId") int studentId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        ppaService.getStudentProfileForViewer(user, studentId);
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
        ppaService.getStudentProfileForViewer(user, studentId);
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
