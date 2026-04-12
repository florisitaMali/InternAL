package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.internaal.dto.ApplicationRequest;
import com.internaal.dto.ApplicationResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class ApplicationRepository {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;

    public ApplicationRepository(
            RestTemplate restTemplate,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon.key}") String anonKey,
            @Value("${supabase.service.role.key:}") String serviceRoleKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.supabaseUrl = supabaseUrl;
        this.anonKey = anonKey;
        this.serviceRoleKey = serviceRoleKey;
    }

    private HttpHeaders createServiceHeaders() {
        String key = (serviceRoleKey != null && !serviceRoleKey.isBlank()) ? serviceRoleKey : anonKey;
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private Optional<JsonNode> fetchArray(String url) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(createServiceHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return Optional.of(objectMapper.readTree(response.getBody()));
            }
        } catch (Exception e) {
            // fall through
        }
        return Optional.empty();
    }

    private Optional<JsonNode> postRow(String url, Object body) {
        try {
            String json = objectMapper.writeValueAsString(body);
            HttpHeaders headers = createServiceHeaders();
            headers.set("Prefer", "return=representation");
            HttpEntity<String> entity = new HttpEntity<>(json, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                if (root.isArray() && root.size() > 0) {
                    return Optional.of(root.get(0));
                }
            }
        } catch (Exception e) {
            // fall through
        }
        return Optional.empty();
    }

    private Integer intValue(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asInt() : null;
    }

    private String textValue(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asText() : null;
    }

    private Boolean boolValue(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asBoolean() : null;
    }

    public Optional<JsonNode> findOpportunityById(Integer opportunityId) {
        String url = supabaseUrl + "/rest/v1/opportunity?opportunity_id=eq." + opportunityId
                + "&select=*&limit=1";
        return fetchArray(url).flatMap(arr ->
                arr.isArray() && arr.size() > 0 ? Optional.of(arr.get(0)) : Optional.empty());
    }

    public Optional<ApplicationResponse> save(Integer studentId, ApplicationRequest request) {
        Optional<JsonNode> opportunityOpt = findOpportunityById(request.getOpportunityId());
        if (opportunityOpt.isEmpty()) {
            return Optional.empty();
        }
        JsonNode opportunity = opportunityOpt.get();
        Integer companyId = intValue(opportunity, "company_id");

        String normalizedType = request.getApplicationType()
                .toUpperCase()
                .replace(" ", "_");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("student_id", studentId);
        body.put("company_id", companyId);
        body.put("opportunity_id", request.getOpportunityId());
        body.put("application_type", normalizedType);
        body.put("is_approved_by_ppa", false);
        body.put("is_approved_by_company", false);
        body.put("accuracy_confirmed", request.getAccuracyConfirmed());

        String url = supabaseUrl + "/rest/v1/application";
        return postRow(url, body).map(this::mapToResponse);
    }

    public List<ApplicationResponse> findByStudentId(Integer studentId) {
        String url = supabaseUrl + "/rest/v1/application?student_id=eq." + studentId
                + "&select=application_id,student_id,company_id,opportunity_id,application_type,accuracy_confirmed,"
                + "created_at,is_approved_by_ppa,is_approved_by_company,opportunity(title),company(name)"
                + "&order=created_at.desc";
        Optional<JsonNode> result = fetchArray(url);
        List<ApplicationResponse> list = new ArrayList<>();
        result.ifPresent(arr -> {
            if (arr.isArray()) {
                arr.forEach(node -> list.add(mapToResponse(node)));
            }
        });
        return list;
    }

    private ApplicationResponse mapToResponse(JsonNode node) {
        ApplicationResponse r = new ApplicationResponse();
        r.setApplicationId(intValue(node, "application_id"));
        r.setStudentId(intValue(node, "student_id"));
        r.setCompanyId(intValue(node, "company_id"));
        r.setOpportunityId(intValue(node, "opportunity_id"));
        r.setApplicationType(textValue(node, "application_type"));
        r.setAccuracyConfirmed(boolValue(node, "accuracy_confirmed"));
        r.setCreatedAt(textValue(node, "created_at"));

        Boolean approvedByPPA = boolValue(node, "is_approved_by_ppa");
        Boolean approvedByCompany = boolValue(node, "is_approved_by_company");
        r.setIsApprovedByPPA(approvedByPPA);
        r.setIsApprovedByCompany(approvedByCompany);

        if (Boolean.TRUE.equals(approvedByPPA) && Boolean.TRUE.equals(approvedByCompany)) {
            r.setStatus("APPROVED");
        } else if (Boolean.FALSE.equals(approvedByPPA) || Boolean.FALSE.equals(approvedByCompany)) {
            r.setStatus("REJECTED");
        } else {
            r.setStatus("PENDING");
        }

        JsonNode opportunity = node.get("opportunity");
        if (opportunity != null && !opportunity.isNull()) {
            r.setOpportunityTitle(textValue(opportunity, "title"));
        }

        JsonNode company = node.get("company");
        if (company != null && !company.isNull()) {
            r.setCompanyName(textValue(company, "name"));
        }

        return r;
    }
}