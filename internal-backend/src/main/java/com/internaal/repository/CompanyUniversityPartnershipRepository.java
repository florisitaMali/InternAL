package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * PostgREST access to {@code company_university_partnership} (service role when configured).
 */
@Repository
public class CompanyUniversityPartnershipRepository {

    private static final Logger log = LoggerFactory.getLogger(CompanyUniversityPartnershipRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Value("${supabase.service.role.key:}")
    private String supabaseServiceRoleKey;

    public CompanyUniversityPartnershipRepository(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    private HttpHeaders serviceHeaders() {
        HttpHeaders headers = new HttpHeaders();
        String key = (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank())
                ? supabaseServiceRoleKey
                : supabaseAnonKey;
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        return headers;
    }

    private static Integer intVal(JsonNode n, String field) {
        JsonNode x = n.get(field);
        if (x == null || x.isNull()) {
            return null;
        }
        return x.isInt() ? x.asInt() : Integer.parseInt(x.asText());
    }

    private static String textVal(JsonNode n, String field) {
        JsonNode x = n.get(field);
        if (x == null || x.isNull()) {
            return null;
        }
        return x.asText();
    }

    public record PartnershipRow(
            int partnershipId,
            int companyId,
            int universityId,
            String status,
            String requestedByRole,
            int requestedById
    ) {}

    public Map<Integer, PartnershipRow> mapByUniversityForCompany(int companyId) {
        if (companyId <= 0) {
            return Map.of();
        }
        try {
            String url = supabaseUrl + "/rest/v1/company_university_partnership?company_id=eq." + companyId
                    + "&select=partnership_id,company_id,university_id,status,requested_by_role,requested_by_id";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(serviceHeaders()), String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return Map.of();
            }
            JsonNode arr = objectMapper.readTree(response.getBody());
            if (!arr.isArray()) {
                return Map.of();
            }
            Map<Integer, PartnershipRow> out = new LinkedHashMap<>();
            for (JsonNode n : arr) {
                PartnershipRow row = parseRow(n);
                if (row != null) {
                    out.put(row.universityId(), row);
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("mapByUniversityForCompany failed: {}", e.getMessage());
            return Map.of();
        }
    }

    public Map<Integer, PartnershipRow> mapByCompanyForUniversity(int universityId) {
        if (universityId <= 0) {
            return Map.of();
        }
        try {
            String url = supabaseUrl + "/rest/v1/company_university_partnership?university_id=eq." + universityId
                    + "&select=partnership_id,company_id,university_id,status,requested_by_role,requested_by_id";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(serviceHeaders()), String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return Map.of();
            }
            JsonNode arr = objectMapper.readTree(response.getBody());
            if (!arr.isArray()) {
                return Map.of();
            }
            Map<Integer, PartnershipRow> out = new LinkedHashMap<>();
            for (JsonNode n : arr) {
                PartnershipRow row = parseRow(n);
                if (row != null) {
                    out.put(row.companyId(), row);
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("mapByCompanyForUniversity failed: {}", e.getMessage());
            return Map.of();
        }
    }

    public Optional<PartnershipRow> findByPair(int companyId, int universityId) {
        if (companyId <= 0 || universityId <= 0) {
            return Optional.empty();
        }
        try {
            String url = supabaseUrl + "/rest/v1/company_university_partnership?company_id=eq." + companyId
                    + "&university_id=eq." + universityId
                    + "&select=partnership_id,company_id,university_id,status,requested_by_role,requested_by_id"
                    + "&limit=1";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(serviceHeaders()), String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return Optional.empty();
            }
            JsonNode arr = objectMapper.readTree(response.getBody());
            if (!arr.isArray() || arr.isEmpty()) {
                return Optional.empty();
            }
            return Optional.ofNullable(parseRow(arr.get(0)));
        } catch (Exception e) {
            log.warn("findByPair failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private PartnershipRow parseRow(JsonNode n) {
        Integer pid = intVal(n, "partnership_id");
        Integer cid = intVal(n, "company_id");
        Integer uid = intVal(n, "university_id");
        String status = textVal(n, "status");
        String role = textVal(n, "requested_by_role");
        Integer rid = intVal(n, "requested_by_id");
        if (pid == null || cid == null || uid == null || status == null || role == null || rid == null) {
            return null;
        }
        return new PartnershipRow(pid, cid, uid, status, role, rid);
    }

    public void insertPending(int companyId, int universityId, String requestedByRole, int requestedById) {
        try {
            HttpHeaders headers = serviceHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Prefer", "return=minimal");
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("company_id", companyId);
            row.put("university_id", universityId);
            row.put("status", "PENDING");
            row.put("requested_by_role", requestedByRole);
            row.put("requested_by_id", requestedById);
            String payload = objectMapper.writeValueAsString(List.of(row));
            String url = supabaseUrl + "/rest/v1/company_university_partnership";
            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(payload, headers), String.class);
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Could not create partnership request");
        }
    }

    public void patchStatusAndRequester(
            int companyId,
            int universityId,
            String status,
            String requestedByRole,
            int requestedById
    ) {
        try {
            HttpHeaders headers = serviceHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Prefer", "return=minimal");
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", status);
            body.put("requested_by_role", requestedByRole);
            body.put("requested_by_id", requestedById);
            String url = supabaseUrl + "/rest/v1/company_university_partnership?company_id=eq." + companyId
                    + "&university_id=eq." + universityId;
            restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                    String.class);
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Could not update partnership");
        }
    }

    public void patchStatus(int companyId, int universityId, String status) {
        try {
            HttpHeaders headers = serviceHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Prefer", "return=minimal");
            Map<String, Object> body = Map.of("status", status);
            String url = supabaseUrl + "/rest/v1/company_university_partnership?company_id=eq." + companyId
                    + "&university_id=eq." + universityId;
            restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                    String.class);
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Could not update partnership status");
        }
    }

    public void deleteByPair(int companyId, int universityId) {
        try {
            HttpHeaders headers = serviceHeaders();
            headers.set("Prefer", "return=minimal");
            String url = supabaseUrl + "/rest/v1/company_university_partnership?company_id=eq." + companyId
                    + "&university_id=eq." + universityId;
            restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(headers), String.class);
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage() != null ? e.getMessage() : "Could not end partnership");
        }
    }
}
