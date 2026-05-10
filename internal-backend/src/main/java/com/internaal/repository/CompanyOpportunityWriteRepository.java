package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Inserts/updates/deletes opportunities and {@code opportunitytarget} rows via PostgREST.
 * Prefers the service role key when configured so RLS does not block company writes.
 */
@Repository
public class CompanyOpportunityWriteRepository {

    private static final Logger log = LoggerFactory.getLogger(CompanyOpportunityWriteRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Value("${supabase.service.role.key:}")
    private String supabaseServiceRoleKey;

    public CompanyOpportunityWriteRepository(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    private HttpHeaders writeHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Content-Type", "application/json");
        headers.set("Prefer", "return=representation");
        if (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) {
            headers.set("apikey", supabaseServiceRoleKey);
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        } else {
            log.warn("SUPABASE_SERVICE_ROLE_KEY unset; company opportunity writes may fail under RLS.");
            headers.set("apikey", supabaseAnonKey);
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getCredentials() instanceof String jwt) {
                headers.set("Authorization", "Bearer " + jwt);
            }
        }
        return headers;
    }

    /**
     * Inserts one opportunity row. Keys must use PostgREST column names (snake_case).
     */
    public int insertOpportunityRow(Map<String, Object> row) {
        try {
            String url = supabaseUrl + "/rest/v1/opportunity";
            String body = objectMapper.writeValueAsString(List.of(row));
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    new HttpEntity<>(body, writeHeaders()),
                    String.class
            );
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray() || array.isEmpty()) {
                throw new IllegalStateException("PostgREST did not return the created opportunity");
            }
            JsonNode created = array.get(0);
            if (!created.has("opportunity_id")) {
                throw new IllegalStateException("Missing opportunity_id in response");
            }
            return created.get("opportunity_id").asInt();
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new IllegalStateException(parseError(e.getResponseBodyAsString(), e.getMessage()));
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Insert failed");
        }
    }

    /** @deprecated Prefer {@link #insertOpportunityRow(Map)} with full column set. */
    @Deprecated
    public int insertOpportunity(
            int companyId,
            String code,
            String title,
            String description,
            List<String> requiredSkills,
            String requiredExperience,
            LocalDate deadline,
            String opportunityType
    ) {
        String t = opportunityType == null || opportunityType.isBlank()
                ? "GENERAL"
                : opportunityType.trim();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("company_id", companyId);
        row.put("code", code);
        row.put("title", title);
        row.put("description", description);
        row.put("required_skills", OpportunityMapper.skillsToCsv(requiredSkills));
        row.put("required_experience", requiredExperience);
        row.put("deadline", deadline.toString());
        row.put("type", t);
        row.put("position_count", 1);
        row.put("is_draft", false);
        return insertOpportunityRow(row);
    }

    public void replaceTargetUniversities(int opportunityId, List<Integer> universityIds) {
        deleteTargets(opportunityId);
        if (universityIds == null || universityIds.isEmpty()) {
            return;
        }
        try {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Integer uid : universityIds) {
                if (uid == null) {
                    continue;
                }
                Map<String, Object> t = new LinkedHashMap<>();
                t.put("opportunity_id", opportunityId);
                t.put("university_id", uid);
                t.put("collaboration_status", "PENDING");
                rows.add(t);
            }
            if (rows.isEmpty()) {
                return;
            }
            String url = supabaseUrl + "/rest/v1/opportunitytarget";
            String body = objectMapper.writeValueAsString(rows);
            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, writeHeaders()), String.class);
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new IllegalStateException(parseError(e.getResponseBodyAsString(), e.getMessage()));
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Could not save target universities");
        }
    }

    public List<Integer> listTargetUniversityIds(int opportunityId) {
        try {
            String url = supabaseUrl + "/rest/v1/opportunitytarget?opportunity_id=eq." + opportunityId
                    + "&select=university_id";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(writeHeaders()), String.class);
            JsonNode arr = objectMapper.readTree(response.getBody());
            List<Integer> out = new ArrayList<>();
            if (arr != null && arr.isArray()) {
                for (JsonNode n : arr) {
                    if (n.has("university_id") && !n.get("university_id").isNull()) {
                        out.add(n.get("university_id").asInt());
                    }
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("listTargetUniversityIds: {}", e.getMessage());
            return List.of();
        }
    }

    public void patchTargetCollaborationStatus(int opportunityId, int universityId, String status) {
        try {
            String url = supabaseUrl + "/rest/v1/opportunitytarget?opportunity_id=eq." + opportunityId
                    + "&university_id=eq." + universityId;
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("collaboration_status", status);
            restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), writeHeaders()),
                    String.class);
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new IllegalStateException(parseError(e.getResponseBodyAsString(), e.getMessage()));
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Could not update collaboration");
        }
    }

    public void deleteTargets(int opportunityId) {
        try {
            String url = supabaseUrl + "/rest/v1/opportunitytarget?opportunity_id=eq." + opportunityId;
            restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(writeHeaders()), String.class);
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new IllegalStateException(parseError(e.getResponseBodyAsString(), e.getMessage()));
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Could not delete targets");
        }
    }

    public void patchOpportunity(int opportunityId, int companyId, Map<String, Object> patch) {
        if (patch.isEmpty()) {
            return;
        }
        try {
            String url = supabaseUrl + "/rest/v1/opportunity?opportunity_id=eq." + opportunityId
                    + "&company_id=eq." + companyId;
            String body = objectMapper.writeValueAsString(patch);
            restTemplate.exchange(url, HttpMethod.PATCH, new HttpEntity<>(body, writeHeaders()), String.class);
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new IllegalStateException(parseError(e.getResponseBodyAsString(), e.getMessage()));
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Update failed");
        }
    }

    public void deleteOpportunity(int opportunityId, int companyId) {
        try {
            deleteTargets(opportunityId);
            String url = supabaseUrl + "/rest/v1/opportunity?opportunity_id=eq." + opportunityId
                    + "&company_id=eq." + companyId;
            restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(writeHeaders()), String.class);
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new IllegalStateException(parseError(e.getResponseBodyAsString(), e.getMessage()));
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Delete failed");
        }
    }

    private static String parseError(String responseBody, String fallback) {
        if (responseBody == null || responseBody.isBlank()) {
            return fallback;
        }
        try {
            JsonNode n = new ObjectMapper().readTree(responseBody);
            if (n.has("message")) {
                return n.get("message").asText();
            }
            if (n.has("error")) {
                return n.get("error").asText();
            }
        } catch (Exception ignored) {
            /* fall through */
        }
        return responseBody.length() > 200 ? responseBody.substring(0, 200) + "…" : responseBody;
    }
}
