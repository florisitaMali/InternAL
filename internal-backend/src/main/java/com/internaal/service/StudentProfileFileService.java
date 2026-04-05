package com.internaal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.StudentFileDownload;
import com.internaal.dto.StudentProfileFileResponse;
import com.internaal.repository.StudentProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class StudentProfileFileService {

    private static final Logger log = LoggerFactory.getLogger(StudentProfileFileService.class);
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024L * 1024L;
    private static final String ALLOWED_MIME_TYPE = "application/pdf";
    private static final byte[] PDF_SIGNATURE = new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D};

    private final RestTemplate restTemplate;
    private final StudentProfileRepository studentProfileRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();
    private final String supabaseUrl;
    private final String supabaseServiceRoleKey;
    private final String storageBucket;
    private final byte[] encryptionKey;

    public StudentProfileFileService(
            RestTemplate restTemplate,
            StudentProfileRepository studentProfileRepository,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.service.role.key:}") String supabaseServiceRoleKey,
            @Value("${supabase.storage.bucket:student-private-files}") String storageBucket,
            @Value("${app.file.encryption.key:}") String encryptionKeyValue
    ) {
        this.restTemplate = restTemplate;
        this.studentProfileRepository = studentProfileRepository;
        this.supabaseUrl = supabaseUrl;
        this.supabaseServiceRoleKey = supabaseServiceRoleKey;
        this.storageBucket = storageBucket;
        this.encryptionKey = decodeEncryptionKey(encryptionKeyValue);
    }

    public StudentProfileFileResponse uploadCv(Integer studentId, MultipartFile file) throws Exception {
        ValidatedFile validatedFile = validatePdfFile(file);
        String storagePath = buildStoragePath(studentId, "cv", validatedFile.safeFilename());
        uploadEncryptedFile(storagePath, validatedFile.bytes());
        studentProfileRepository.upsertCvFile(studentId, storagePath, validatedFile.originalFilename());

        return studentProfileRepository.getCvFile(studentId)
                .orElseThrow(() -> new IllegalStateException("Could not load saved CV metadata"));
    }

    public Optional<StudentFileDownload> downloadCv(Integer studentId) throws Exception {
        Optional<StudentProfileFileResponse> cvFile = studentProfileRepository.getCvFile(studentId);
        if (cvFile.isEmpty()) {
            return Optional.empty();
        }

        byte[] bytes = downloadDecryptedFile(cvFile.get().getStoragePath());
        return Optional.of(new StudentFileDownload(bytes, cvFile.get().getOriginalFilename(), ALLOWED_MIME_TYPE));
    }

    public boolean deleteCv(Integer studentId) throws Exception {
        Optional<StudentProfileFileResponse> cvFile = studentProfileRepository.getCvFile(studentId);
        if (cvFile.isEmpty()) {
            return false;
        }

        deleteStoredFile(cvFile.get().getStoragePath());
        studentProfileRepository.clearCvFile(studentId);
        return true;
    }

    public StudentProfileFileResponse uploadCertification(Integer studentId, MultipartFile file, String displayName) throws Exception {
        ValidatedFile validatedFile = validatePdfFile(file);
        String resolvedDisplayName = displayName == null || displayName.isBlank()
                ? stripPdfExtension(validatedFile.originalFilename())
                : displayName.trim();

        String storagePath = buildStoragePath(studentId, "certifications", validatedFile.safeFilename());
        uploadEncryptedFile(storagePath, validatedFile.bytes());

        return studentProfileRepository.createCertificationFile(
                        studentId,
                        resolvedDisplayName,
                        storagePath,
                        validatedFile.originalFilename(),
                        ALLOWED_MIME_TYPE,
                        validatedFile.bytes().length
                )
                .orElseThrow(() -> new IllegalStateException("Could not save certification metadata"));
    }

    public Optional<StudentFileDownload> downloadCertification(Integer studentId, Integer certificationId) throws Exception {
        Optional<StudentProfileFileResponse> file = studentProfileRepository.findCertificationFile(studentId, certificationId);
        if (file.isEmpty()) {
            return Optional.empty();
        }

        byte[] bytes = downloadDecryptedFile(file.get().getStoragePath());
        return Optional.of(new StudentFileDownload(bytes, file.get().getOriginalFilename(), file.get().getMimeType()));
    }

    public boolean deleteCertification(Integer studentId, Integer certificationId) throws Exception {
        Optional<StudentProfileFileResponse> file = studentProfileRepository.findCertificationFile(studentId, certificationId);
        if (file.isEmpty()) {
            return false;
        }

        deleteStoredFile(file.get().getStoragePath());
        return studentProfileRepository.deleteCertificationFile(studentId, certificationId);
    }

    private ValidatedFile validatePdfFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }

        if (file.getSize() <= 0) {
            throw new IllegalArgumentException("File is empty");
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("File exceeds 5 MB limit");
        }

        String originalFilename = Optional.ofNullable(file.getOriginalFilename()).orElse("document.pdf").trim();
        String normalizedLower = originalFilename.toLowerCase(Locale.ROOT);
        if (!normalizedLower.endsWith(".pdf")) {
            throw new IllegalArgumentException("Only PDF files are allowed");
        }

        if (normalizedLower.contains(".pdf.") || normalizedLower.matches(".*\\.(exe|js|bat|cmd|scr)$")) {
            throw new IllegalArgumentException("Suspicious file extension");
        }

        String contentType = file.getContentType();
        if (contentType != null && !ALLOWED_MIME_TYPE.equalsIgnoreCase(contentType.trim())) {
            throw new IllegalArgumentException("Only PDF files are allowed");
        }

        try {
            byte[] bytes = file.getBytes();
            if (bytes.length < PDF_SIGNATURE.length) {
                throw new IllegalArgumentException("Invalid PDF file");
            }

            for (int i = 0; i < PDF_SIGNATURE.length; i++) {
                if (bytes[i] != PDF_SIGNATURE[i]) {
                    throw new IllegalArgumentException("Invalid PDF signature");
                }
            }

            return new ValidatedFile(originalFilename, bytes, sanitizeFilename(originalFilename));
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not read uploaded file", e);
        }
    }

    private void uploadEncryptedFile(String storagePath, byte[] plaintextBytes) throws Exception {
        ensureStorageConfigured();
        byte[] encryptedBytes = encrypt(plaintextBytes);

        HttpHeaders headers = createStorageHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.set("x-upsert", "true");

        restTemplate.exchange(
                supabaseUrl + "/storage/v1/object/" + storageBucket + "/" + storagePath,
                HttpMethod.POST,
                new HttpEntity<>(encryptedBytes, headers),
                String.class
        );
    }

    private byte[] downloadDecryptedFile(String storagePath) throws Exception {
        ensureStorageConfigured();

        ResponseEntity<byte[]> response = restTemplate.exchange(
                supabaseUrl + "/storage/v1/object/" + storageBucket + "/" + storagePath,
                HttpMethod.GET,
                new HttpEntity<>(createStorageHeaders()),
                byte[].class
        );

        byte[] encryptedBytes = response.getBody();
        if (encryptedBytes == null || encryptedBytes.length == 0) {
            throw new IllegalStateException("Stored file is empty");
        }

        return decrypt(encryptedBytes);
    }

    private void deleteStoredFile(String storagePath) throws Exception {
        ensureStorageConfigured();

        restTemplate.exchange(
                supabaseUrl + "/storage/v1/object/" + storageBucket + "/" + storagePath,
                HttpMethod.DELETE,
                new HttpEntity<>(createStorageHeaders()),
                String.class
        );
    }

    private HttpHeaders createStorageHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseServiceRoleKey);
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        return headers;
    }

    private void ensureStorageConfigured() {
        if (supabaseServiceRoleKey == null || supabaseServiceRoleKey.isBlank()) {
            throw new IllegalStateException("SUPABASE_SERVICE_ROLE_KEY is required for file uploads");
        }
        if (encryptionKey.length == 0) {
            throw new IllegalStateException("APP_FILE_ENCRYPTION_KEY is required for encrypted file uploads");
        }
    }

    private byte[] encrypt(byte[] plaintext) throws GeneralSecurityException {
        byte[] iv = new byte[12];
        secureRandom.nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(encryptionKey, "AES"), new GCMParameterSpec(128, iv));
        byte[] ciphertext = cipher.doFinal(plaintext);

        ByteBuffer buffer = ByteBuffer.allocate(4 + iv.length + ciphertext.length);
        buffer.putInt(iv.length);
        buffer.put(iv);
        buffer.put(ciphertext);
        return buffer.array();
    }

    private byte[] decrypt(byte[] encrypted) throws GeneralSecurityException {
        ByteBuffer buffer = ByteBuffer.wrap(encrypted);
        int ivLength = buffer.getInt();
        if (ivLength <= 0 || ivLength > 32 || buffer.remaining() <= ivLength) {
            throw new GeneralSecurityException("Invalid encrypted file payload");
        }

        byte[] iv = new byte[ivLength];
        buffer.get(iv);
        byte[] ciphertext = new byte[buffer.remaining()];
        buffer.get(ciphertext);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(encryptionKey, "AES"), new GCMParameterSpec(128, iv));
        return cipher.doFinal(ciphertext);
    }

    private byte[] decodeEncryptionKey(String value) {
        if (value == null || value.isBlank()) {
            return new byte[0];
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(value.trim());
            if (decoded.length == 16 || decoded.length == 24 || decoded.length == 32) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
            log.warn("APP_FILE_ENCRYPTION_KEY is not valid base64, deriving a 256-bit key from the provided text");
        }

        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Could not derive encryption key", e);
        }
    }

    private String buildStoragePath(Integer studentId, String folder, String filename) {
        return "students/" + studentId + "/" + folder + "/" + Instant.now().toEpochMilli() + "-" + UUID.randomUUID() + "-" + filename;
    }

    private String sanitizeFilename(String filename) {
        return filename.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private String stripPdfExtension(String filename) {
        if (filename == null) {
            return "Certification";
        }
        return filename.toLowerCase(Locale.ROOT).endsWith(".pdf")
                ? filename.substring(0, filename.length() - 4)
                : filename;
    }

    private record ValidatedFile(String originalFilename, byte[] bytes, String safeFilename) {}
}
