package com.internaal.service;

import com.internaal.repository.StudentProfileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class StudentProfileImageService {

    private static final long MAX_BYTES = 5L * 1024L * 1024L;

    private final RestTemplate restTemplate;
    private final StudentProfileRepository studentProfileRepository;
    private final String supabaseUrl;
    private final String supabaseServiceRoleKey;
    private final String profileBucket;

    public StudentProfileImageService(
            RestTemplate restTemplate,
            StudentProfileRepository studentProfileRepository,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.service.role.key:}") String supabaseServiceRoleKey,
            @Value("${supabase.storage.profile-bucket:user-profile-photo}") String profileBucket) {
        this.restTemplate = restTemplate;
        this.studentProfileRepository = studentProfileRepository;
        this.supabaseUrl = supabaseUrl.endsWith("/") ? supabaseUrl.substring(0, supabaseUrl.length() - 1) : supabaseUrl;
        this.supabaseServiceRoleKey = supabaseServiceRoleKey;
        this.profileBucket = profileBucket;
    }

    public String uploadProfilePhoto(Integer studentId, MultipartFile file) throws Exception {
        validateImage(file);
        String objectPath = "student/profile-photo/" + studentId + "/" + UUID.randomUUID() + safeExt(file);
        putObject(objectPath, file);
        studentProfileRepository.upsertProfilePhotoUrl(studentId, publicUrl(objectPath));
        return publicUrl(objectPath);
    }

    public String uploadProfileCover(Integer studentId, MultipartFile file) throws Exception {
        validateImage(file);
        String objectPath = "student/cover/" + studentId + "/" + UUID.randomUUID() + safeExt(file);
        putObject(objectPath, file);
        studentProfileRepository.upsertProfileCoverUrl(studentId, publicUrl(objectPath));
        return publicUrl(objectPath);
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("File exceeds 5 MB limit");
        }
        String ct = Optional.ofNullable(file.getContentType()).orElse("").toLowerCase(Locale.ROOT);
        if (!ct.startsWith("image/jpeg") && !ct.startsWith("image/png") && !ct.startsWith("image/gif")
                && !ct.startsWith("image/webp")) {
            throw new IllegalArgumentException("Only JPG, PNG, GIF, or WebP images are allowed");
        }
    }

    private String safeExt(MultipartFile file) {
        String name = Optional.ofNullable(file.getOriginalFilename()).orElse("image").toLowerCase(Locale.ROOT);
        if (name.endsWith(".png")) {
            return ".png";
        }
        if (name.endsWith(".gif")) {
            return ".gif";
        }
        if (name.endsWith(".webp")) {
            return ".webp";
        }
        return ".jpg";
    }

    private void putObject(String objectPath, MultipartFile file) throws Exception {
        if (supabaseServiceRoleKey == null || supabaseServiceRoleKey.isBlank()) {
            throw new IllegalStateException("SUPABASE_SERVICE_ROLE_KEY is required for profile image uploads");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseServiceRoleKey);
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        headers.setContentType(MediaType.parseMediaType(
                Optional.ofNullable(file.getContentType()).orElse(MediaType.IMAGE_JPEG_VALUE)));
        headers.set("x-upsert", "true");

        String url = supabaseUrl + "/storage/v1/object/" + profileBucket + "/" + objectPath;
        restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(file.getBytes(), headers), String.class);
    }

    private String publicUrl(String objectPath) {
        return supabaseUrl + "/storage/v1/object/public/" + profileBucket + "/" + objectPath;
    }
}
