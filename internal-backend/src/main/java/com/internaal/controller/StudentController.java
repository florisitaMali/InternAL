package com.internaal.controller;

import com.internaal.dto.StudentFileDownload;
import com.internaal.dto.StudentProfileFileResponse;
import com.internaal.dto.StudentProfileResponse;
import com.internaal.dto.StudentProfileUpdateRequest;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.repository.StudentProfileRepository;
import com.internaal.service.StudentProfileFileService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/student")
public class StudentController {

    private final StudentProfileRepository studentProfileRepository;
    private final StudentProfileFileService studentProfileFileService;

    public StudentController(
            StudentProfileRepository studentProfileRepository,
            StudentProfileFileService studentProfileFileService) {
        this.studentProfileRepository = studentProfileRepository;
        this.studentProfileFileService = studentProfileFileService;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> currentProfile(
            @AuthenticationPrincipal UserAccount user,
            HttpServletRequest request) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthenticated"));
        }

        if (user.getRole() != Role.STUDENT) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Current user is not a student"));
        }

        String userJwt = extractBearerToken(request);
        if (userJwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Missing bearer token"));
        }
        Integer studentId = parseStudentId(user);

        Optional<StudentProfileResponse> profile = studentProfileRepository.findByStudentId(
                studentId,
                userJwt
        );

        if (profile.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Student profile not found"));
        }

        return ResponseEntity.ok(profile.get());
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal UserAccount user,
            HttpServletRequest request,
            @RequestBody StudentProfileUpdateRequest updateRequest) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthenticated"));
        }

        if (user.getRole() != Role.STUDENT) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Current user is not a student"));
        }

        String userJwt = extractBearerToken(request);
        if (userJwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Missing bearer token"));
        }
        Integer studentId = parseStudentId(user);

        Optional<StudentProfileResponse> savedProfile = studentProfileRepository.saveByStudentId(
                studentId,
                userJwt,
                updateRequest
        );

        if (savedProfile.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not save student profile"));
        }

        return ResponseEntity.ok(savedProfile.get());
    }

    @PostMapping(value = "/profile/cv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadCv(
            @AuthenticationPrincipal UserAccount user,
            @RequestParam("file") MultipartFile file) {
        ResponseEntity<Map<String, String>> guard = guardStudentUser(user);
        if (guard != null) {
            return guard;
        }
        Integer studentId = parseStudentId(user);

        try {
            StudentProfileFileResponse savedFile = studentProfileFileService.uploadCv(studentId, file);
            return ResponseEntity.ok(savedFile);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not upload CV"));
        }
    }

    @GetMapping("/profile/cv")
    public ResponseEntity<?> downloadCv(@AuthenticationPrincipal UserAccount user) {
        ResponseEntity<Map<String, String>> guard = guardStudentUser(user);
        if (guard != null) {
            return guard;
        }
        Integer studentId = parseStudentId(user);

        try {
            Optional<StudentFileDownload> file = studentProfileFileService.downloadCv(studentId);
            if (file.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "CV not found"));
            }
            return buildFileDownloadResponse(file.get());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not download CV"));
        }
    }

    @DeleteMapping("/profile/cv")
    public ResponseEntity<?> deleteCv(@AuthenticationPrincipal UserAccount user) {
        ResponseEntity<Map<String, String>> guard = guardStudentUser(user);
        if (guard != null) {
            return guard;
        }
        Integer studentId = parseStudentId(user);

        try {
            boolean deleted = studentProfileFileService.deleteCv(studentId);
            if (!deleted) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "CV not found"));
            }
            return ResponseEntity.ok(Map.of("status", "deleted"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not delete CV"));
        }
    }

    @PostMapping(value = "/profile/certifications", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadCertification(
            @AuthenticationPrincipal UserAccount user,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "displayName", required = false) String displayName) {
        ResponseEntity<Map<String, String>> guard = guardStudentUser(user);
        if (guard != null) {
            return guard;
        }
        Integer studentId = parseStudentId(user);

        try {
            StudentProfileFileResponse savedFile = studentProfileFileService.uploadCertification(
                    studentId,
                    file,
                    displayName
            );
            return ResponseEntity.ok(savedFile);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not upload certification"));
        }
    }

    @GetMapping("/profile/certifications")
    public ResponseEntity<?> listCertifications(@AuthenticationPrincipal UserAccount user) {
        ResponseEntity<Map<String, String>> guard = guardStudentUser(user);
        if (guard != null) {
            return guard;
        }

        return ResponseEntity.ok(studentProfileRepository.listCertificationFiles(parseStudentId(user)));
    }

    @GetMapping("/profile/certifications/{id}")
    public ResponseEntity<?> downloadCertification(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("id") Integer certificationId) {
        ResponseEntity<Map<String, String>> guard = guardStudentUser(user);
        if (guard != null) {
            return guard;
        }
        Integer studentId = parseStudentId(user);

        try {
            Optional<StudentFileDownload> file = studentProfileFileService.downloadCertification(
                    studentId,
                    certificationId
            );
            if (file.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Certification not found"));
            }
            return buildFileDownloadResponse(file.get());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not download certification"));
        }
    }

    @DeleteMapping("/profile/certifications/{id}")
    public ResponseEntity<?> deleteCertification(
            @AuthenticationPrincipal UserAccount user,
            @PathVariable("id") Integer certificationId) {
        ResponseEntity<Map<String, String>> guard = guardStudentUser(user);
        if (guard != null) {
            return guard;
        }
        Integer studentId = parseStudentId(user);

        try {
            boolean deleted = studentProfileFileService.deleteCertification(studentId, certificationId);
            if (!deleted) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Certification not found"));
            }
            return ResponseEntity.ok(Map.of("status", "deleted"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not delete certification"));
        }
    }

    private String extractBearerToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return authHeader.substring(7);
    }

    private ResponseEntity<Map<String, String>> guardStudentUser(UserAccount user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthenticated"));
        }

        if (user.getRole() != Role.STUDENT) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Current user is not a student"));
        }

        return null;
    }

    private Integer parseStudentId(UserAccount user) {
        try {
            return Integer.valueOf(user.getLinkedEntityId());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Account linked_entity_id must be a numeric student id");
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
