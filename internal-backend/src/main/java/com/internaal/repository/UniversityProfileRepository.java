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
public class UniversityProfileRepository {

    private static final Logger log = LoggerFactory.getLogger(UniversityProfileRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Value("${supabase.service.role.key:}")
    private String supabaseServiceRoleKey;

    public UniversityProfileRepository(RestTemplate restTemplate) {
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

    private HttpHeaders patchHeaders(String userJwt) {
        if (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", supabaseServiceRoleKey);
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
            headers.set("Content-Type", "application/json");
            headers.set("Prefer", "return=representation");
            return headers;
        }
        log.warn("SUPABASE_SERVICE_ROLE_KEY unset; university PATCH may update 0 rows if RLS blocks UPDATE.");
        return authHeaders(userJwt);
    }

    private HttpHeaders serviceRoleReadHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseServiceRoleKey);
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        headers.set("Content-Type", "application/json");
        return headers;
    }

    public Optional<JsonNode> findByUniversityId(int universityId, String userJwt) {
        Optional<JsonNode> a = getRow(universityId, "university_id", authHeaders(userJwt));
        return a.isPresent() ? a : getRow(universityId, "id", authHeaders(userJwt));
    }

    public Optional<JsonNode> findByUniversityIdReadable(int universityId, String userJwt) {
        Optional<JsonNode> first;
        try {
            first = findByUniversityId(universityId, userJwt);
        } catch (PostgrestException e) {
            int c = e.getStatusCode();
            if (c != 401 && c != 403) {
                throw e;
            }
            log.debug("university read with user JWT denied ({}), will try service role if configured", c);
            first = Optional.empty();
        }
        if (first.isPresent()) {
            return first;
        }
        if (supabaseServiceRoleKey == null || supabaseServiceRoleKey.isBlank()) {
            return Optional.empty();
        }
        HttpHeaders h = serviceRoleReadHeaders();
        Optional<JsonNode> a = getRow(universityId, "university_id", h);
        return a.isPresent() ? a : getRow(universityId, "id", h);
    }

    /**
     * For cross-role read-only views (e.g. company opening a university from the partners list): prefer service role
     * when configured so RLS on {@code university} does not block before fallback (same idea as
     * {@code OpportunityRepository#universityLookupHeaders}).
     */
    public Optional<JsonNode> findByUniversityIdForPartnershipProfile(int universityId, String userJwt) {
        if (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) {
            HttpHeaders h = serviceRoleReadHeaders();
            Optional<JsonNode> a = getRow(universityId, "university_id", h);
            if (a.isPresent()) {
                return a;
            }
            Optional<JsonNode> b = getRow(universityId, "id", h);
            if (b.isPresent()) {
                return b;
            }
        }
        return findByUniversityIdReadable(universityId, userJwt);
    }

    private Optional<JsonNode> getRow(int universityId, String eqColumn, HttpHeaders headers) {
        String url = supabaseUrl + "/rest/v1/university?" + eqColumn + "=eq." + universityId + "&select=*";
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
                log.debug("university GET {}=eq.{}: {}", eqColumn, universityId, e.getResponseBodyAsString());
                return Optional.empty();
            }
            throw new PostgrestException(code, parsePostgrestErrorMessage(e.getResponseBodyAsString()));
        } catch (HttpServerErrorException e) {
            throw new PostgrestException(
                    e.getStatusCode().value(),
                    parsePostgrestErrorMessage(e.getResponseBodyAsString())
            );
        } catch (JsonProcessingException e) {
            log.error("UniversityProfileRepository: invalid JSON: {}", e.getMessage());
            throw new PostgrestException(502, "Invalid JSON from PostgREST");
        } catch (RestClientException e) {
            log.error("UniversityProfileRepository GET failed: {}", e.getMessage());
            throw new PostgrestException(502, e.getMessage());
        }
    }

    public Optional<JsonNode> patchUniversity(int universityId, String userJwt, Map<String, Object> patchBody) {
        if (patchBody.isEmpty()) {
            return findByUniversityId(universityId, userJwt);
        }
        Optional<JsonNode> a = tryPatch(universityId, userJwt, patchBody, "university_id");
        if (a.isPresent()) {
            return a;
        }
        return tryPatch(universityId, userJwt, patchBody, "id");
    }

    private Optional<JsonNode> tryPatch(
            int universityId,
            String userJwt,
            Map<String, Object> patchBody,
            String eqColumn
    ) {
        String url = supabaseUrl + "/rest/v1/university?" + eqColumn + "=eq." + universityId;
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
                return findByUniversityId(universityId, userJwt);
            }
            JsonNode node = objectMapper.readTree(body);
            if (node != null && node.isArray()) {
                if (node.isEmpty()) {
                    return Optional.empty();
                }
                return Optional.of(node.get(0));
            }
            return findByUniversityId(universityId, userJwt);
        } catch (HttpClientErrorException e) {
            int code = e.getStatusCode().value();
            String raw = e.getResponseBodyAsString();
            if (code == 400 && isLikelyMissingEqColumn(eqColumn, raw)) {
                log.debug("university PATCH {}=eq.{}: {}", eqColumn, universityId, raw);
                return Optional.empty();
            }
            throw new PostgrestException(code, parsePostgrestErrorMessage(raw));
        } catch (HttpServerErrorException e) {
            throw new PostgrestException(
                    e.getStatusCode().value(),
                    parsePostgrestErrorMessage(e.getResponseBodyAsString())
            );
        } catch (JsonProcessingException e) {
            log.error("UniversityProfileRepository PATCH: invalid JSON: {}", e.getMessage());
            throw new PostgrestException(502, "Invalid JSON from PostgREST");
        } catch (RestClientException e) {
            log.error("UniversityProfileRepository PATCH failed: {}", e.getMessage());
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
        return m.contains("university." + eqColumn.toLowerCase(Locale.ROOT));
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

    /**
     * Maps to {@code university} columns: {@code founded} (not {@code founded_year}) and
     * {@code number_of_employees} per schema used by system-admin university APIs.
     */
    public static Map<String, Object> toPatchMap(
            String name,
            String location,
            String description,
            String website,
            String email,
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
        if (email != null) {
            m.put("email", email);
        }
        if (employeeCount != null) {
            m.put("number_of_employees", employeeCount);
        }
        if (foundedYear != null) {
            m.put("founded", foundedYear);
        }
        if (specialties != null) {
            m.put("specialties", specialties);
        }
        /* Same column names as {@code company}: {@code logo_url}, {@code cover_url} */
        if (logoUrl != null) {
            m.put("logo_url", logoUrl);
        }
        if (coverUrl != null) {
            m.put("cover_url", coverUrl);
        }
        return m;
    }
}
