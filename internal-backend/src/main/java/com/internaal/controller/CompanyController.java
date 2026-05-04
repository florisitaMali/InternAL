package com.internaal.controller;

import com.internaal.dto.ApplicationResponse;
import com.internaal.dto.CompanyProfileResponse;
import com.internaal.dto.CompanyProfileUpdateRequest;
import com.internaal.dto.StudentFileDownload;
import com.internaal.dto.StudentProfileResponse;
import com.internaal.entity.UserAccount;
import com.internaal.service.CompanyService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

    @PatchMapping("/applications/{applicationId}/approve")
    public ApplicationResponse approveApplication(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("applicationId") int applicationId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return companyService.decideApplication(user, applicationId, true);
    }

    @PatchMapping("/applications/{applicationId}/reject")
    public ApplicationResponse rejectApplication(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("applicationId") int applicationId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return companyService.decideApplication(user, applicationId, false);
    }

    @GetMapping("/students/{studentId}/profile")
    public StudentProfileResponse getStudentProfile(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("studentId") int studentId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return companyService.getStudentProfile(user, studentId);
    }

    @GetMapping("/students/{studentId}/cv")
    public ResponseEntity<byte[]> downloadStudentCv(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("studentId") int studentId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return buildFileDownloadResponse(companyService.downloadStudentCv(user, studentId));
    }

    @GetMapping("/students/{studentId}/certifications/{certificationId}")
    public ResponseEntity<byte[]> downloadStudentCertification(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("studentId") int studentId,
            @PathVariable("certificationId") int certificationId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return buildFileDownloadResponse(
                companyService.downloadStudentCertification(user, studentId, certificationId));
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
