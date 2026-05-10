package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.CertificationMetadataUpdateRequest;
import com.internaal.dto.StudentExperienceResponse;
import com.internaal.dto.StudentExperienceUpsertRequest;
import com.internaal.dto.StudentProfileFileResponse;
import com.internaal.dto.StudentProfileResponse;
import com.internaal.dto.StudentProfileUpdateRequest;
import com.internaal.dto.StudentProjectResponse;
import com.internaal.dto.StudentProjectUpsertRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.Collections;
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
    /**
     * When false, banner_title is omitted from profile upserts and cover uploads are rejected until
     * {@code sql/alter-studentprofile-banner-cover.sql} has been applied (PostgREST PGRST204 otherwise).
     */
    private final boolean studentProfileBannerCoverColumns;

    public StudentProfileRepository(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon.key}") String supabaseAnonKey,
            @Value("${supabase.service.role.key:}") String supabaseServiceRoleKey,
            @Value("${supabase.profile.banner-cover-columns:false}") boolean studentProfileBannerCoverColumns) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl;
        this.supabaseAnonKey = supabaseAnonKey;
        this.supabaseServiceRoleKey = supabaseServiceRoleKey;
        this.studentProfileBannerCoverColumns = studentProfileBannerCoverColumns;
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
            response.setProjects(listStudentProjects(studentId, userJwt));
            response.setExperiences(listStudentExperiences(studentId, userJwt));
            return Optional.of(response);
        } catch (Exception e) {
            log.error("Failed to load student profile: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    /**
     * Service-role load of a student profile by id. Bypasses RLS so trusted backend
     * flows (e.g. the company-side "view applicant profile" feature) can read any
     * student's profile. Authorization MUST be enforced at the service layer before
     * calling this — this method does not check who's allowed to see the data.
     */
    public Optional<StudentProfileResponse> findByStudentIdAsService(Integer studentId) {
        try {
            HttpHeaders headers = createServiceHeaders();
            JsonNode studentNode = fetchSingleRow("student", "student_id", studentId, headers);
            if (studentNode == null || studentNode.isNull()) {
                return Optional.empty();
            }
            JsonNode profileNode = fetchSingleRow("studentprofile", "student_id", studentId, headers);
            StudentProfileResponse response = mapProfileResponse(studentNode, profileNode);
            response.setCertificationFiles(listCertificationFiles(studentId));
            response.setProjects(fetchStudentProjects(studentId, createServiceHeaders()));
            response.setExperiences(fetchStudentExperiences(studentId, createServiceHeaders()));
            return Optional.of(response);
        } catch (Exception e) {
            log.error("Failed to load student profile (service): {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public Optional<StudentProfileResponse> saveByStudentId(
            Integer studentId,
            String userJwt,
            StudentProfileUpdateRequest request) {
        try {
            HttpHeaders headers = createServiceHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            upsertStudentProfile(studentId, request, headers);
            return findByStudentId(studentId, userJwt);
        } catch (Exception e) {
            log.error("Failed to save student profile: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public Optional<Integer> findUniversityIdByStudentId(Integer studentId) {
        try {
            JsonNode studentNode = fetchSingleRow("student", "student_id", studentId, createAuthenticatedHeaders());
            return Optional.ofNullable(intValue(studentNode, "university_id"));
        } catch (Exception e) {
            log.error("findUniversityIdByStudentId failed: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<String> findSkillsByStudentId(Integer studentId) {
        try {
            JsonNode profileNode = fetchSingleRow("studentprofile", "student_id", studentId, createAuthenticatedHeaders());
            return splitCsv(textValue(profileNode, "skills"));
        } catch (Exception e) {
            log.error("findSkillsByStudentId failed: {}", e.getMessage(), e);
            return Collections.emptyList();
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

    public List<StudentProjectResponse> listStudentProjects(Integer studentId, String userJwt) {
        List<StudentProjectResponse> rows = fetchStudentProjects(studentId, createUserHeaders(userJwt));
        if (!rows.isEmpty()) {
            return rows;
        }
        try {
            List<StudentProjectResponse> viaService = fetchStudentProjects(studentId, createServiceHeaders());
            if (!viaService.isEmpty()) {
                return viaService;
            }
        } catch (Exception e) {
            log.debug("Service-role project fetch skipped or failed: {}", e.getMessage());
        }
        return rows;
    }

    public List<StudentExperienceResponse> listStudentExperiences(Integer studentId, String userJwt) {
        List<StudentExperienceResponse> rows = fetchStudentExperiences(studentId, createUserHeaders(userJwt));
        if (!rows.isEmpty()) {
            return rows;
        }
        try {
            List<StudentExperienceResponse> viaService = fetchStudentExperiences(studentId, createServiceHeaders());
            if (!viaService.isEmpty()) {
                return viaService;
            }
        } catch (Exception e) {
            log.debug("Service-role experience fetch skipped or failed: {}", e.getMessage());
        }
        return rows;
    }

    private List<StudentProjectResponse> fetchStudentProjects(Integer studentId, HttpHeaders headers) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/studentproject")
                    .queryParam("student_id", "eq." + studentId)
                    .queryParam("select", "*")
                    .queryParam("order", "project_id.asc")
                    .toUriString();
            JsonNode array = fetchArray(url, headers);
            List<StudentProjectResponse> rows = new ArrayList<>();
            if (array == null) {
                return rows;
            }
            for (JsonNode node : array) {
                rows.add(mapStudentProject(node));
            }
            return rows;
        } catch (Exception e) {
            log.warn("fetchStudentProjects failed: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<StudentExperienceResponse> fetchStudentExperiences(Integer studentId, HttpHeaders headers) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(supabaseUrl + "/rest/v1/studentexperience")
                    .queryParam("student_id", "eq." + studentId)
                    .queryParam("select", "*")
                    .queryParam("order", "start_date.desc")
                    .toUriString();
            JsonNode array = fetchArray(url, headers);
            List<StudentExperienceResponse> rows = new ArrayList<>();
            if (array == null) {
                return rows;
            }
            for (JsonNode node : array) {
                rows.add(mapStudentExperience(node));
            }
            return rows;
        } catch (Exception e) {
            log.warn("fetchStudentExperiences failed: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    public Optional<StudentExperienceResponse> insertStudentExperience(
            Integer studentId,
            StudentExperienceUpsertRequest request,
            HttpHeaders writeHeaders) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.putAll(writeHeaders);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Prefer", "return=representation");

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("student_id", studentId);
        row.put("company_name", request.getCompanyName());
        row.put("position", request.getPosition());
        row.put("start_date", request.getStartDate());
        row.put("end_date", request.getEndDate());
        row.put("description", request.getDescription());

        JsonNode inserted = postRowsWithServiceFallbackOnForbidden("studentexperience", List.of(row), headers, null, studentId);
        if (inserted == null || inserted.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(mapStudentExperience(inserted.get(0)));
    }

    public Optional<StudentExperienceResponse> updateStudentExperience(
            Integer studentId,
            Integer experienceId,
            StudentExperienceUpsertRequest request,
            HttpHeaders writeHeaders) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("company_name", request.getCompanyName());
        body.put("position", request.getPosition());
        body.put("start_date", request.getStartDate());
        body.put("end_date", request.getEndDate());
        body.put("description", request.getDescription());

        JsonNode updated = patchSingleRowWithServiceFallbackOnForbidden(
                "studentexperience",
                body,
                writeHeaders,
                "experience_id",
                experienceId,
                "student_id",
                studentId,
                studentId
        );
        if (updated == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(mapStudentExperience(updated));
    }

    public boolean deleteStudentExperience(Integer studentId, Integer experienceId, HttpHeaders writeHeaders)
            throws Exception {
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/studentexperience")
                .queryParam("experience_id", "eq." + experienceId)
                .queryParam("student_id", "eq." + studentId)
                .toUriString();
        deleteWithServiceFallbackOnForbidden(url, writeHeaders, studentId, "studentexperience");
        return true;
    }

    public Optional<StudentProjectResponse> insertStudentProject(
            Integer studentId,
            StudentProjectUpsertRequest request,
            HttpHeaders writeHeaders) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.putAll(writeHeaders);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Prefer", "return=representation");

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("student_id", studentId);
        row.put("title", request.getTitle());
        row.put("github_url", request.getGithubUrl());
        row.put("description", request.getDescription());
        row.put("skills", request.getSkills());

        JsonNode inserted = postRowsWithServiceFallbackOnForbidden("studentproject", List.of(row), headers, null, studentId);
        if (inserted == null || inserted.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(mapStudentProject(inserted.get(0)));
    }

    public Optional<StudentProjectResponse> updateStudentProject(
            Integer studentId,
            Integer projectId,
            StudentProjectUpsertRequest request,
            HttpHeaders writeHeaders) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", request.getTitle());
        body.put("github_url", request.getGithubUrl());
        body.put("description", request.getDescription());
        body.put("skills", request.getSkills());

        JsonNode updated = patchSingleRowWithServiceFallbackOnForbidden(
                "studentproject",
                body,
                writeHeaders,
                "project_id",
                projectId,
                "student_id",
                studentId,
                studentId
        );
        if (updated == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(mapStudentProject(updated));
    }

    public boolean deleteStudentProject(Integer studentId, Integer projectId, HttpHeaders writeHeaders) throws Exception {
        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/studentproject")
                .queryParam("project_id", "eq." + projectId)
                .queryParam("student_id", "eq." + studentId)
                .toUriString();
        deleteWithServiceFallbackOnForbidden(url, writeHeaders, studentId, "studentproject");
        return true;
    }

    public boolean updateCertificationMetadata(
            Integer studentId,
            Integer certificationId,
            CertificationMetadataUpdateRequest request,
            HttpHeaders writeHeaders) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        if (request.getDisplayName() != null) {
            body.put("display_name", request.getDisplayName());
        }
        if (request.getIssuer() != null) {
            body.put("issuer", request.getIssuer());
        }
        if (request.getIssueDate() != null) {
            body.put("issue_date", request.getIssueDate());
        }
        if (body.isEmpty()) {
            return false;
        }
        JsonNode updated = patchSingleRowWithServiceFallbackOnForbidden(
                "studentprofile_certification",
                body,
                writeHeaders,
                "certification_id",
                certificationId,
                "student_id",
                studentId,
                studentId
        );
        return updated != null;
    }

    public void upsertProfilePhotoUrl(Integer studentId, String photoUrl) throws Exception {
        HttpHeaders headers = createServiceHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("student_id", studentId);
        row.put("photo", photoUrl);
        postRows("studentprofile", List.of(row), headers, "resolution=merge-duplicates");
    }

    public void upsertProfileCoverUrl(Integer studentId, String coverUrl) throws Exception {
        if (!studentProfileBannerCoverColumns) {
            throw new IllegalArgumentException(
                    "cover_url is not available until banner_title and cover_url columns exist. "
                            + "Run sql/alter-studentprofile-banner-cover.sql, then set "
                            + "supabase.profile.banner-cover-columns=true (or SUPABASE_PROFILE_BANNER_COVER_COLUMNS=true).");
        }
        HttpHeaders headers = createServiceHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("student_id", studentId);
        row.put("cover_url", coverUrl);
        postRows("studentprofile", List.of(row), headers, "resolution=merge-duplicates");
    }

    private JsonNode patchSingleRow(
            String table,
            Map<String, Object> body,
            HttpHeaders baseHeaders,
            String idColumn,
            Object idValue,
            String ownerColumn,
            Object ownerValue) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.putAll(baseHeaders);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Prefer", "return=representation");

        String url = UriComponentsBuilder
                .fromHttpUrl(supabaseUrl + "/rest/v1/" + table)
                .queryParam(idColumn, "eq." + idValue)
                .queryParam(ownerColumn, "eq." + ownerValue)
                .toUriString();

        String json = objectMapper.writeValueAsString(body);
        ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.PATCH,
                new HttpEntity<>(json, headers),
                String.class
        );
        if (response.getBody() == null || response.getBody().isBlank()) {
            return null;
        }
        JsonNode tree = objectMapper.readTree(response.getBody());
        if (tree.isArray() && tree.isEmpty()) {
            return null;
        }
        if (tree.isArray() && !tree.isEmpty()) {
            return tree.get(0);
        }
        return null;
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
            long sizeBytes) {
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
        Boolean canApplyForPp = readCanApplyForPpFlag(studentNode);
        response.setCanApplyForPp(canApplyForPp != null ? canApplyForPp : Boolean.TRUE);
        Boolean hasPremium = readHasPremiumFlag(studentNode);
        response.setHasPremium(hasPremium != null ? hasPremium : Boolean.FALSE);
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
            response.setPhoto(textValue(profileNode, "photo"));
            response.setCoverUrl(textValue(profileNode, "cover_url"));
            response.setBannerTitle(textValue(profileNode, "banner_title"));
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
        if (studentProfileBannerCoverColumns) {
            row.put("banner_title", request.getBannerTitle() != null ? request.getBannerTitle() : "");
        }

        postRowsWithServiceFallbackOnForbidden("studentprofile", List.of(row), headers, "resolution=merge-duplicates", studentId);
    }

    private boolean serviceRoleConfigured() {
        return supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank();
    }

    private HttpHeaders serviceHeadersMirroring(HttpHeaders userHeaders) {
        HttpHeaders svc = new HttpHeaders();
        svc.set("apikey", supabaseServiceRoleKey);
        svc.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        if (userHeaders.getContentType() != null) {
            svc.setContentType(userHeaders.getContentType());
        } else {
            svc.setContentType(MediaType.APPLICATION_JSON);
        }
        if (userHeaders.containsKey("Prefer")) {
            svc.put("Prefer", userHeaders.get("Prefer"));
        }
        return svc;
    }

    /** POST to a collection: retry on auth failures only. */
    private static boolean shouldRetryPostWithService(HttpClientErrorException e) {
        int code = e.getStatusCode().value();
        return code == HttpStatus.UNAUTHORIZED.value() || code == HttpStatus.FORBIDDEN.value();
    }

    /**
     * PATCH/DELETE on a filtered row: PostgREST/Supabase may return 404 or 406 when RLS hides the row
     * (RestTemplate throws before we see an empty 200 body). Service role bypasses RLS.
     */
    private static boolean shouldRetryPatchOrDeleteWithService(HttpClientErrorException e) {
        int code = e.getStatusCode().value();
        return code == HttpStatus.UNAUTHORIZED.value()
                || code == HttpStatus.FORBIDDEN.value()
                || code == HttpStatus.NOT_FOUND.value()
                || code == HttpStatus.NOT_ACCEPTABLE.value();
    }

    /**
     * When RLS rejects the end-user JWT (401/403), retry POST with the service role.
     * Requires {@code SUPABASE_SERVICE_ROLE_KEY}; tighten RLS policies in Supabase when ready.
     */
    private JsonNode postRowsWithServiceFallbackOnForbidden(
            String table,
            List<Map<String, Object>> rows,
            HttpHeaders userHeaders,
            String preferHeader,
            int studentId) throws Exception {
        try {
            return postRows(table, rows, userHeaders, preferHeader);
        } catch (HttpClientErrorException e) {
            if (serviceRoleConfigured() && shouldRetryPostWithService(e)) {
                log.warn("PostgREST POST {} returned {} for student {}; retrying with service role", table, e.getStatusCode().value(), studentId);
                return postRows(table, rows, serviceHeadersMirroring(userHeaders), preferHeader);
            }
            throw e;
        }
    }

    private JsonNode patchSingleRowWithServiceFallbackOnForbidden(
            String table,
            Map<String, Object> body,
            HttpHeaders baseHeaders,
            String idColumn,
            Object idValue,
            String ownerColumn,
            Object ownerValue,
            int studentId) throws Exception {
        try {
            JsonNode row = patchSingleRow(table, body, baseHeaders, idColumn, idValue, ownerColumn, ownerValue);
            // PostgREST often returns 200 with [] when RLS hides the row (not always 403); retry with service role.
            if (row == null && serviceRoleConfigured()) {
                log.warn(
                        "PostgREST PATCH {} matched no row for student {} (RLS or id mismatch); retrying with service role",
                        table,
                        studentId);
                return patchSingleRow(table, body, createServiceHeaders(), idColumn, idValue, ownerColumn, ownerValue);
            }
            return row;
        } catch (HttpClientErrorException e) {
            if (serviceRoleConfigured() && shouldRetryPatchOrDeleteWithService(e)) {
                log.warn("PostgREST PATCH {} returned {} for student {}; retrying with service role", table, e.getStatusCode().value(), studentId);
                return patchSingleRow(table, body, createServiceHeaders(), idColumn, idValue, ownerColumn, ownerValue);
            }
            throw e;
        }
    }

    private void deleteWithServiceFallbackOnForbidden(String url, HttpHeaders writeHeaders, int studentId, String table) throws Exception {
        try {
            restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(writeHeaders), String.class);
        } catch (HttpClientErrorException e) {
            if (serviceRoleConfigured() && shouldRetryPatchOrDeleteWithService(e)) {
                log.warn("PostgREST DELETE {} returned {} for student {}; retrying with service role", table, e.getStatusCode().value(), studentId);
                restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(createServiceHeaders()), String.class);
                return;
            }
            throw e;
        }
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

    public HttpHeaders createUserHeaders(String userJwt) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseAnonKey);
        headers.set("Authorization", "Bearer " + userJwt);
        return headers;
    }

    private HttpHeaders createAuthenticatedHeaders() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() instanceof String jwt && !jwt.isBlank()) {
            return createUserHeaders(jwt);
        }
        return createServiceHeadersSafely();
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

    private StudentExperienceResponse mapStudentExperience(JsonNode node) {
        StudentExperienceResponse row = new StudentExperienceResponse();
        row.setExperienceId(intValue(node, "experience_id"));
        row.setCompanyName(textValue(node, "company_name"));
        row.setPosition(textValue(node, "position"));
        row.setStartDate(textValue(node, "start_date"));
        row.setEndDate(textValue(node, "end_date"));
        row.setDescription(textValue(node, "description"));
        return row;
    }

    private StudentProjectResponse mapStudentProject(JsonNode node) {
        StudentProjectResponse row = new StudentProjectResponse();
        row.setProjectId(intValue(node, "project_id"));
        row.setTitle(textValue(node, "title"));
        row.setGithubUrl(textValue(node, "github_url"));
        row.setDescription(textValue(node, "description"));
        row.setSkills(textValue(node, "skills"));
        return row;
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
        file.setIssuer(textValue(node, "issuer"));
        file.setIssueDate(textValue(node, "issue_date"));
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

    /**
     * PostgREST uses Postgres column names in JSON — unquoted identifiers are lowercased ({@code canapplyforpp}),
     * quoted camelCase stays mixed. This finds the PP-eligibility flag regardless.
     */
    private Boolean readCanApplyForPpFlag(JsonNode row) {
        if (row == null || row.isNull()) {
            return null;
        }
        final String target = "canapplyforpp";
        var fields = row.fields();
        while (fields.hasNext()) {
            var e = fields.next();
            String norm = e.getKey().replace("_", "").toLowerCase();
            if (target.equals(norm) && !e.getValue().isNull()) {
                return e.getValue().asBoolean();
            }
        }
        return null;
    }

    /**
     * Same tolerant matching as {@link #readCanApplyForPpFlag} for {@code hasPremium} / {@code haspremium}.
     */
    private Boolean readHasPremiumFlag(JsonNode row) {
        if (row == null || row.isNull()) {
            return null;
        }
        final String target = "haspremium";
        var fields = row.fields();
        while (fields.hasNext()) {
            var e = fields.next();
            String norm = e.getKey().replace("_", "").toLowerCase();
            if (target.equals(norm) && !e.getValue().isNull()) {
                return e.getValue().asBoolean();
            }
        }
        return null;
    }

    /**
     * Demo: sets {@code hasPremium} on the student row via PostgREST, then reloads the profile.
     * Real PSP integration should verify payment before calling this.
     */
    public Optional<StudentProfileResponse> completeMockPremiumPayment(Integer studentId, String userJwt) throws Exception {
        HttpHeaders headers = createUserHeaders(userJwt);
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("hasPremium", Boolean.TRUE);
        JsonNode updated = patchSingleRowWithServiceFallbackOnForbidden(
                "student",
                body,
                headers,
                "student_id",
                studentId,
                "student_id",
                studentId,
                studentId);
        if (updated == null) {
            return Optional.empty();
        }
        return findByStudentId(studentId, userJwt);
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

    private static List<String> splitCsv(String raw) {
        if (raw == null || raw.isBlank()) {
            return new ArrayList<>();
        }
        List<String> out = new ArrayList<>();
        for (String s : raw.split(",")) {
            if (s != null && !s.isBlank()) {
                out.add(s.trim());
            }
        }
        return out;
    }
}
