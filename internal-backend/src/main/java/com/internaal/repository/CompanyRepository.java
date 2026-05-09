package com.internaal.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.exception.PostgrestException;
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
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Repository
public class CompanyRepository {

    private static final Logger log = LoggerFactory.getLogger(CompanyRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Value("${supabase.service.role.key:}")
    private String supabaseServiceRoleKey;

    public CompanyRepository(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    private HttpHeaders authHeaders(String userJwt) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseAnonKey);
        headers.set("Content-Type", "application/json");
        headers.set("Prefer", "return=representation");
        headers.set("Authorization", "Bearer " + userJwt);
        return headers;
    }

    /** Service role bypasses RLS for PATCH; companyId is still enforced in CompanyService. */
    private HttpHeaders patchHeaders(String userJwt) {
        if (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", supabaseServiceRoleKey);
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
            headers.set("Content-Type", "application/json");
            headers.set("Prefer", "return=representation");
            return headers;
        }
        log.warn("SUPABASE_SERVICE_ROLE_KEY unset; company PATCH may update 0 rows if RLS blocks UPDATE.");
        return authHeaders(userJwt);
    }

    public Optional<JsonNode> findByCompanyId(int companyId, String userJwt) {
        Optional<JsonNode> byCompanyId = getCompanyRow(companyId, userJwt, "company_id");
        return byCompanyId.isPresent() ? byCompanyId : getCompanyRow(companyId, userJwt, "id");
    }

    /**
     * Resolve company row using the caller JWT first; if RLS blocks the read, fall back to service role (when configured).
     */
    public Optional<JsonNode> findByCompanyIdReadable(int companyId, String userJwt) {
        Optional<JsonNode> first = findByCompanyId(companyId, userJwt);
        if (first.isPresent()) {
            return first;
        }
        if (supabaseServiceRoleKey == null || supabaseServiceRoleKey.isBlank()) {
            return Optional.empty();
        }
        HttpHeaders h = serviceRoleReadHeaders();
        Optional<JsonNode> a = getCompanyRowWithHeaders(companyId, "company_id", h);
        return a.isPresent() ? a : getCompanyRowWithHeaders(companyId, "id", h);
    }

    private HttpHeaders serviceRoleReadHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseServiceRoleKey);
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        headers.set("Content-Type", "application/json");
        return headers;
    }

    private Optional<JsonNode> getCompanyRow(int companyId, String userJwt, String eqColumn) {
        return getCompanyRowWithHeaders(companyId, eqColumn, authHeaders(userJwt));
    }

    /**
     * Read a company row with the Supabase service role (bypasses RLS). Used for university-admin views so the
     * admin JWT is not required to have SELECT on {@code company}.
     */
    public Optional<JsonNode> findByCompanyIdWithServiceRole(int companyId) {
        if (supabaseServiceRoleKey == null || supabaseServiceRoleKey.isBlank()) {
            return Optional.empty();
        }
        HttpHeaders h = new HttpHeaders();
        h.set("apikey", supabaseServiceRoleKey);
        h.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        h.set("Content-Type", "application/json");
        Optional<JsonNode> a = getCompanyRowWithHeaders(companyId, "company_id", h);
        return a.isPresent() ? a : getCompanyRowWithHeaders(companyId, "id", h);
    }

    private Optional<JsonNode> getCompanyRowWithHeaders(int companyId, String eqColumn, HttpHeaders headers) {
        String url = supabaseUrl + "/rest/v1/company?" + eqColumn + "=eq." + companyId + "&select=*";
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new PostgrestException(
                        response.getStatusCode().value(),
                        "PostgREST returned " + response.getStatusCode()
                );
            }
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray() || array.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(array.get(0));
        } catch (HttpClientErrorException e) {
            int code = e.getStatusCode().value();
            if (code == 400) {
                log.debug("company GET {}=eq.{}: {}", eqColumn, companyId, e.getResponseBodyAsString());
                return Optional.empty();
            }
            throw new PostgrestException(code, parsePostgrestErrorMessage(e.getResponseBodyAsString()));
        } catch (HttpServerErrorException e) {
            throw new PostgrestException(
                    e.getStatusCode().value(),
                    parsePostgrestErrorMessage(e.getResponseBodyAsString())
            );
        } catch (JsonProcessingException e) {
            log.error("CompanyRepository: invalid JSON: {}", e.getMessage());
            throw new PostgrestException(502, "Invalid JSON from PostgREST");
        } catch (RestClientException e) {
            log.error("CompanyRepository GET failed: {}", e.getMessage());
            throw new PostgrestException(502, e.getMessage());
        }
    }

    public Optional<JsonNode> patchCompany(int companyId, String userJwt, Map<String, Object> patchBody) {
        if (patchBody.isEmpty()) {
            return findByCompanyId(companyId, userJwt);
        }
        Optional<JsonNode> a = tryPatchCompany(companyId, userJwt, patchBody, "company_id");
        if (a.isPresent()) {
            return a;
        }
        Optional<JsonNode> b = tryPatchCompany(companyId, userJwt, patchBody, "id");
        if (b.isPresent()) {
            return b;
        }
        return Optional.empty();
    }

    private Optional<JsonNode> tryPatchCompany(
            int companyId,
            String userJwt,
            Map<String, Object> patchBody,
            String eqColumn
    ) {
        String url = supabaseUrl + "/rest/v1/company?" + eqColumn + "=eq." + companyId;
        try {
            String json = objectMapper.writeValueAsString(patchBody);
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    new HttpEntity<>(json, patchHeaders(userJwt)),
                    String.class
            );
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new PostgrestException(
                        response.getStatusCode().value(),
                        "PostgREST returned " + response.getStatusCode()
                );
            }
            String body = response.getBody();
            if (body == null || body.isBlank()) {
                return findByCompanyId(companyId, userJwt);
            }
            JsonNode node = objectMapper.readTree(body);
            if (node != null && node.isArray()) {
                if (node.isEmpty()) {
                    // Zero rows updated — never return stale row as "success"
                    return Optional.empty();
                }
                return Optional.of(node.get(0));
            }
            return findByCompanyId(companyId, userJwt);
        } catch (HttpClientErrorException e) {
            int code = e.getStatusCode().value();
            String raw = e.getResponseBodyAsString();
            if (code == 400 && isLikelyMissingEqColumn(eqColumn, raw)) {
                log.debug("company PATCH {}=eq.{}: {}", eqColumn, companyId, raw);
                return Optional.empty();
            }
            throw new PostgrestException(code, parsePostgrestErrorMessage(raw));
        } catch (HttpServerErrorException e) {
            throw new PostgrestException(
                    e.getStatusCode().value(),
                    parsePostgrestErrorMessage(e.getResponseBodyAsString())
            );
        } catch (JsonProcessingException e) {
            log.error("CompanyRepository PATCH: invalid JSON: {}", e.getMessage());
            throw new PostgrestException(502, "Invalid JSON from PostgREST");
        } catch (RestClientException e) {
            log.error("CompanyRepository PATCH failed: {}", e.getMessage());
            throw new PostgrestException(502, e.getMessage());
        }
    }

    private static boolean isLikelyMissingEqColumn(String eqColumn, String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return false;
        }
        String m = responseBody.toLowerCase(Locale.ROOT);
        if (!m.contains("does not exist")) {
            return false;
        }
        return m.contains("company." + eqColumn.toLowerCase(Locale.ROOT));
    }

    private static String parsePostgrestErrorMessage(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "PostgREST request failed";
        }
        try {
            JsonNode root = new ObjectMapper().readTree(responseBody);
            if (root.hasNonNull("message")) {
                return root.get("message").asText();
            }
            if (root.hasNonNull("error")) {
                return root.get("error").asText();
            }
        } catch (Exception ignored) {
            // fall through
        }
        String trimmed = responseBody.trim();
        return trimmed.length() > 500 ? trimmed.substring(0, 500) + "…" : trimmed;
    }

    public static Map<String, Object> toPatchMap(
            String name,
            String location,
            String description,
            String website,
            String industry,
            Integer employeeCount,
            Integer foundedYear,
            String specialties,
            String logoUrl,
            String coverUrl
    ) {
        Map<String, Object> m = new HashMap<>();
        if (name != null) {
            m.put("name", name);
        }
        if (location != null) {
            m.put("location", location);
        }
        if (description != null) {
            m.put("description", description);
        }
        if (website != null) {
            m.put("website", website);
        }
        if (industry != null) {
            m.put("industry", industry);
        }
        if (employeeCount != null) {
            m.put("employee_count", employeeCount);
        }
        if (foundedYear != null) {
            m.put("founded_year", foundedYear);
        }
        if (specialties != null) {
            m.put("specialties", specialties);
        }
        if (logoUrl != null) {
            m.put("logo_url", logoUrl);
        }
        if (coverUrl != null) {
            m.put("cover_url", coverUrl);
        }
        return m;
    }
}
