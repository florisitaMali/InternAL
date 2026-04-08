package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.StudentProfileFileResponse;
import com.internaal.dto.StudentProfileResponse;
import com.internaal.dto.StudentProfileUpdateRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class StudentProfileRepository {

    private static final Logger log = LoggerFactory.getLogger(StudentProfileRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String supabaseAnonKey;
    private final String supabaseServiceRoleKey;

    public StudentProfileRepository(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon.key}") String supabaseAnonKey,
            @Value("${supabase.service.role.key:}") String supabaseServiceRoleKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl;
        this.supabaseAnonKey = supabaseAnonKey;
        this.supabaseServiceRoleKey = supabaseServiceRoleKey;
    }

    public Optional<StudentProfileResponse> findByStudentId(Integer studentId, String userJwt) {
        try {
            HttpHeaders headers = createUserHeaders(userJwt);
            JsonNode studentNode = fetchSingleRow("student", "student_id", studentId, headers);
            if (studentNode == null || studentNode.isNull()) {
                return Optional.empty();
            }

            JsonNode profileNode = fetchSingleRow("studentprofile", "student_id", studentId, headers);
            StudentProfileResponse response = mapProfileResponse(studentNode, profileNode);
            response.setCertificationFiles(listCertificationFiles(studentId));
            return Optional.of(response);
        } catch (Exception e) {
            log.error("Failed to load student profile: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public Optional<StudentProfileResponse> saveByStudentId(
            Integer studentId,
            String userJwt,
            StudentProfileUpdateRequest request
    ) {
        try {
            HttpHeaders headers = createUserHeaders(userJwt);
            headers.setContentType(MediaType.APPLICATION_JSON);

            upsertStudentProfile(studentId, request, headers);
            return findByStudentId(studentId, userJwt);
        } catch (Exception e) {
            log.error("Failed to save student profile: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public Optional<StudentProfileFileResponse> getCvFile(Integer studentId) {
        try {
            JsonNode profileNode = fetchSingleRow("studentprofile", "student_id", studentId, createServiceHeaders());
            return Optional.ofNullable(mapCvFile(profileNode));
        } catch (Exception e) {
            log.error("Failed to load CV metadata: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public void upsertCvFile(Integer studentId, String storagePath, String originalFilename) throws Exception {
        HttpHeaders headers = createServiceHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("student_id", studentId);
        row.put("cv_url", storagePath);
        row.put("cv_filename", originalFilename);

        postRows("studentprofile", List.of(row), headers, "resolution=merge-duplicates");
    }

    public void clearCvFile(Integer studentId) throws Exception {
        HttpHeaders headers = createServiceHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("student_id", studentId);
        row.put("cv_url", null);
        row.put("cv_filename", null);

        postRows("studentprofile", List.of(row), headers, "resolution=merge-duplicates");
    }

    public List<StudentProfileFileResponse> listCertificationFiles(Integer studentId) {
        try {
            HttpHeaders headers = createServiceHeaders();
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/studentprofile_certification")
                    .queryParam("student_id", "eq." + studentId)
                    .queryParam("select", "*")
                    .queryParam("order", "uploaded_at.desc")
                    .toUriString();

            JsonNode array = fetchArray(url, headers);
            List<StudentProfileFileResponse> files = new ArrayList<>();
            if (array == null) {
                return files;
            }

            for (JsonNode node : array) {
                files.add(mapCertificationFile(node));
            }
            return files;
        } catch (Exception e) {
            log.error("Failed to load certification files: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    public Optional<StudentProfileFileResponse> createCertificationFile(
            Integer studentId,
            String displayName,
            String storagePath,
            String originalFilename,
            String mimeType,
            long sizeBytes
    ) {
        try {
            HttpHeaders headers = createServiceHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Prefer", "return=representation");

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("student_id", studentId);
            row.put("display_name", displayName);
            row.put("storage_path", storagePath);
            row.put("original_filename", originalFilename);
            row.put("mime_type", mimeType);
            row.put("size_bytes", sizeBytes);

            JsonNode inserted = postRows("studentprofile_certification", List.of(row), headers, null);
            if (inserted == null || inserted.isEmpty()) {
                return Optional.empty();
            }

            return Optional.ofNullable(mapCertificationFile(inserted.get(0)));
        } catch (Exception e) {
            log.error("Failed to create certification metadata: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public Optional<StudentProfileFileResponse> findCertificationFile(Integer studentId, Integer certificationId) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/studentprofile_certification")
                    .queryParam("certification_id", "eq." + certificationId)
                    .queryParam("student_id", "eq." + studentId)
                    .queryParam("select", "*")
                    .queryParam("limit", 1)
                    .toUriString();

            JsonNode array = fetchArray(url, createServiceHeaders());
            if (array == null || array.isEmpty()) {
                return Optional.empty();
            }

            return Optional.ofNullable(mapCertificationFile(array.get(0)));
        } catch (Exception e) {
            log.error("Failed to load certification metadata: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public boolean deleteCertificationFile(Integer studentId, Integer certificationId) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/studentprofile_certification")
                    .queryParam("certification_id", "eq." + certificationId)
                    .queryParam("student_id", "eq." + studentId)
                    .toUriString();

            restTemplate.exchange(
                    url,
                    HttpMethod.DELETE,
                    new HttpEntity<>(createServiceHeaders()),
                    String.class
            );
            return true;
        } catch (Exception e) {
            log.error("Failed to delete certification metadata: {}", e.getMessage(), e);
            return false;
        }
    }

    private StudentProfileResponse mapProfileResponse(JsonNode studentNode, JsonNode profileNode) {
        StudentProfileResponse response = new StudentProfileResponse();
        response.setStudentId(intValue(studentNode, "student_id"));
        response.setFullName(textValue(studentNode, "full_name"));
        response.setEmail(textValue(studentNode, "email"));
        response.setPhone(textValue(studentNode, "phone"));
        response.setUniversityId(intValue(studentNode, "university_id"));
        response.setUniversityName(resolveNameById("university", "university_id", studentNode, createServiceHeadersSafely()));
        response.setDepartmentId(intValue(studentNode, "department_id"));
        response.setDepartmentName(resolveNameById("department", "department_id", studentNode, createServiceHeadersSafely()));
        response.setFieldId(intValue(studentNode, "field_id"));
        response.setFieldName(resolveNameById("studyfield", "field_id", studentNode, createServiceHeadersSafely()));
        response.setStudyYear(intValue(studentNode, "study_year"));
        response.setCgpa(studentNode.has("cgpa") && !studentNode.get("cgpa").isNull()
                ? studentNode.get("cgpa").decimalValue() : null);
        response.setHasCompletedPp(boolValue(studentNode, "has_completed_pp"));
        response.setAccessStartDate(textValue(studentNode, "access_start_date"));
        response.setAccessEndDate(textValue(studentNode, "access_end_date"));

        if (profileNode != null && !profileNode.isNull()) {
            response.setDescription(textValue(profileNode, "description"));
            response.setSkills(textValue(profileNode, "skills"));
            response.setCertificates(textValue(profileNode, "certificates"));
            response.setLanguages(textValue(profileNode, "languages"));
            response.setExperience(textValue(profileNode, "experience"));
            response.setHobbies(textValue(profileNode, "hobbies"));
            response.setCvUrl(textValue(profileNode, "cv_url"));
            response.setCvFilename(textValue(profileNode, "cv_filename"));
            response.setCvFile(mapCvFile(profileNode));
        }

        return response;
    }

    private JsonNode fetchSingleRow(String table, String idColumn, Integer idValue, HttpHeaders headers) throws Exception {
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/" + table)
                .queryParam(idColumn, "eq." + idValue)
                .queryParam("select", "*")
                .queryParam("limit", 1)
                .toUriString();

        JsonNode array = fetchArray(url, headers);
        if (array == null || array.isEmpty()) {
            return null;
        }

        return array.get(0);
    }

    private JsonNode fetchArray(String url, HttpHeaders headers) throws Exception {
        ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        if (response.getBody() == null || response.getBody().isBlank()) {
            return null;
        }
        return objectMapper.readTree(response.getBody());
    }

    private void upsertStudentProfile(Integer studentId, StudentProfileUpdateRequest request, HttpHeaders headers) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("student_id", studentId);
        row.put("description", request.getDescription());
        row.put("skills", request.getSkills());
        row.put("certificates", request.getCertificates());
        row.put("languages", request.getLanguages());
        row.put("experience", request.getExperience());
        row.put("hobbies", request.getHobbies());

        postRows("studentprofile", List.of(row), headers, "resolution=merge-duplicates");
    }

    private JsonNode postRows(String table, List<Map<String, Object>> rows, HttpHeaders headers, String preferHeader) throws Exception {
        HttpHeaders requestHeaders = new HttpHeaders();
        requestHeaders.putAll(headers);
        if (preferHeader != null && !preferHeader.isBlank()) {
            requestHeaders.set("Prefer", headers.containsKey("Prefer")
                    ? String.join(",", headers.get("Prefer")) + "," + preferHeader
                    : preferHeader);
        }

        String body = objectMapper.writeValueAsString(rows);
        ResponseEntity<String> response = restTemplate.exchange(
                supabaseUrl + "/rest/v1/" + table,
                HttpMethod.POST,
                new HttpEntity<>(body, requestHeaders),
                String.class
        );

        if (response.getBody() == null || response.getBody().isBlank()) {
            return null;
        }
        return objectMapper.readTree(response.getBody());
    }

    private HttpHeaders createUserHeaders(String userJwt) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseAnonKey);
        headers.set("Authorization", "Bearer " + userJwt);
        return headers;
    }

    private HttpHeaders createServiceHeaders() {
        if (supabaseServiceRoleKey == null || supabaseServiceRoleKey.isBlank()) {
            throw new IllegalStateException("SUPABASE_SERVICE_ROLE_KEY is required for file operations");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseServiceRoleKey);
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        return headers;
    }

    private HttpHeaders createServiceHeadersSafely() {
        try {
            return createServiceHeaders();
        } catch (IllegalStateException ignored) {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", supabaseAnonKey);
            return headers;
        }
    }

    private StudentProfileFileResponse mapCvFile(JsonNode profileNode) {
        String storagePath = textValue(profileNode, "cv_url");
        String originalFilename = textValue(profileNode, "cv_filename");
        if (storagePath == null || originalFilename == null) {
            return null;
        }

        StudentProfileFileResponse file = new StudentProfileFileResponse();
        file.setDisplayName(originalFilename);
        file.setStoragePath(storagePath);
        file.setOriginalFilename(originalFilename);
        file.setDownloadUrl("/api/student/profile/cv");
        return file;
    }

    private StudentProfileFileResponse mapCertificationFile(JsonNode node) {
        StudentProfileFileResponse file = new StudentProfileFileResponse();
        file.setCertificationId(intValue(node, "certification_id"));
        file.setDisplayName(textValue(node, "display_name"));
        file.setStoragePath(textValue(node, "storage_path"));
        file.setOriginalFilename(textValue(node, "original_filename"));
        file.setMimeType(textValue(node, "mime_type"));
        file.setSizeBytes(longValue(node, "size_bytes"));
        file.setUploadedAt(textValue(node, "uploaded_at"));
        if (file.getCertificationId() != null) {
            file.setDownloadUrl("/api/student/profile/certifications/" + file.getCertificationId());
        }
        return file;
    }

    private Integer intValue(JsonNode node, String field) {
        return node != null && node.has(field) && !node.get(field).isNull() ? node.get(field).asInt() : null;
    }

    private Long longValue(JsonNode node, String field) {
        return node != null && node.has(field) && !node.get(field).isNull() ? node.get(field).asLong() : null;
    }

    private Boolean boolValue(JsonNode node, String field) {
        return node != null && node.has(field) && !node.get(field).isNull() ? node.get(field).asBoolean() : null;
    }

    private String textValue(JsonNode node, String field) {
        return node != null && node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }

    private String resolveNameById(String table, String idField, JsonNode studentNode, HttpHeaders headers) {
        try {
            Integer id = intValue(studentNode, idField);
            if (id == null) {
                return null;
            }

            JsonNode node = fetchSingleRow(table, idField, id, headers);
            if (node == null || node.isNull()) {
                return null;
            }

            if (node.has("name") && !node.get("name").isNull()) {
                return node.get("name").asText();
            }
        } catch (Exception e) {
            log.warn("Failed to resolve name for table {} and id field {}: {}", table, idField, e.getMessage());
        }
        return null;
    }
}
