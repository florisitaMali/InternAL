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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Repository
public class StudentProfileRepository {

    private static final Logger log = LoggerFactory.getLogger(StudentProfileRepository.class);

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseAnonKey);
        headers.set("Content-Type", "application/json");
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() instanceof String jwt) {
            headers.set("Authorization", "Bearer " + jwt);
        }
        return headers;
    }

    public Optional<Integer> findUniversityIdByStudentId(Integer studentId) {
        try {
            String url = supabaseUrl + "/rest/v1/student?student_id=eq." + studentId
                    + "&select=university_id&limit=1";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(authHeaders()), String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray() || array.isEmpty()) {
                return Optional.empty();
            }
            JsonNode node = array.get(0);
            if (!node.has("university_id") || node.get("university_id").isNull()) {
                return Optional.empty();
            }
            return Optional.of(node.get("university_id").asInt());
        } catch (Exception e) {
            log.error("findUniversityIdByStudentId failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public List<String> findSkillsByStudentId(Integer studentId) {
        try {
            String url = supabaseUrl + "/rest/v1/studentprofile?student_id=eq." + studentId
                    + "&select=skills&limit=1";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(authHeaders()), String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray() || array.isEmpty()) {
                return Collections.emptyList();
            }
            JsonNode node = array.get(0);
            if (!node.has("skills") || node.get("skills").isNull()) {
                return Collections.emptyList();
            }
            return splitCsv(node.get("skills").asText());
        } catch (Exception e) {
            log.error("findSkillsByStudentId failed: {}", e.getMessage());
            return Collections.emptyList();
        }
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
