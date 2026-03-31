package com.internaal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class OpportunityService {

  private static final String APPLICATION_JSON = "application/json";
  private final HttpClient httpClient = HttpClient.newHttpClient();
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final String supabaseUrl;
  private final String serviceRoleKey;

  public OpportunityService(
      @Value("${supabase.url}") String supabaseUrl,
      @Value("${supabase.service-role-key}") String serviceRoleKey
  ) {
    this.supabaseUrl = stripTrailingSlash(supabaseUrl);
    this.serviceRoleKey = serviceRoleKey;
  }

  public List<Map<String, Object>> findAll() {
    String select =
        "opportunity_id,company_id,title,description,required_skills,required_experience,deadline,type,"
            + "company:company_id(name,location,industry),opportunitytarget(university_id)";

    String url =
        supabaseUrl
            + "/rest/v1/opportunity?select="
            + encode(select)
            + "&order=deadline.asc.nullslast";

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("apikey", serviceRoleKey)
            .header("Authorization", "Bearer " + serviceRoleKey)
            .header("Accept", APPLICATION_JSON)
            .GET()
            .build();

    try {
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new RuntimeException("Supabase read failed: " + response.statusCode() + " " + response.body());
      }

      JsonNode root = objectMapper.readTree(response.body());
      if (!root.isArray()) return List.of();

      return StreamSupport.stream(root.spliterator(), false)
          .map(this::mapRow)
          .toList();
    } catch (IOException | InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("Failed to fetch opportunities from Supabase REST.", e);
    }
  }

  private Map<String, Object> mapRow(JsonNode rowNode) {
    Map<String, Object> row = new LinkedHashMap<>();
    JsonNode companyNode = rowNode.path("company");
    JsonNode targetNode = rowNode.path("opportunitytarget");

    row.put("id", asString(rowNode.get("opportunity_id")));
    row.put("companyId", asString(rowNode.get("company_id")));
    row.put("companyName", asString(companyNode.get("name")));
    row.put("title", asString(rowNode.get("title")));
    row.put("description", asString(rowNode.get("description")));
    row.put("requiredSkills", parseSkills(asString(rowNode.get("required_skills"))));
    row.put("requiredExperience", asString(rowNode.get("required_experience")));
    row.put("deadline", asString(rowNode.get("deadline")));
    row.put("type", asString(rowNode.get("type")));
    row.put("companyLocation", asString(companyNode.get("location")));
    row.put("companyIndustry", asString(companyNode.get("industry")));
    row.put(
        "targetUniversityIds",
        targetNode.isArray()
            ? StreamSupport.stream(targetNode.spliterator(), false)
                .map(n -> asString(n.get("university_id")))
                .filter(s -> s != null && !s.isBlank())
                .toList()
            : List.of()
    );

    return row;
  }

  private List<String> parseSkills(String raw) {
    if (raw == null || raw.isBlank()) return List.of();

    String trimmed = raw.trim();
    if (trimmed.isEmpty()) return List.of();

    // Support a couple common formats:
    // - "React, TypeScript"
    // - "{React,TypeScript}"
    // - "[React, TypeScript]"
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      trimmed = trimmed.substring(1, trimmed.length() - 1);
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      trimmed = trimmed.substring(1, trimmed.length() - 1);
    }

    return java.util.Arrays.stream(trimmed.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .toList();
  }

  public int submitApplication(
      Integer studentId,
      Integer companyId,
      Integer opportunityId,
      String applicationType,
      Boolean accuracyConfirmed
  ) {
    String url = supabaseUrl + "/rest/v1/application";
    String body =
        "{"
            + "\"student_id\":" + studentId + ","
            + "\"company_id\":" + companyId + ","
            + "\"opportunity_id\":" + opportunityId + ","
            + "\"application_type\":\"" + escapeJson(applicationType) + "\","
            + "\"is_approved_by_ppa\":false,"
            + "\"is_approved_by_company\":false,"
            + "\"accuracy_confirmed\":" + (Boolean.TRUE.equals(accuracyConfirmed) ? "true" : "false")
            + "}";

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("apikey", serviceRoleKey)
            .header("Authorization", "Bearer " + serviceRoleKey)
            .header("Content-Type", APPLICATION_JSON)
            .header("Prefer", "return=minimal")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

    try {
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new RuntimeException("Supabase insert failed: " + response.statusCode() + " " + response.body());
      }
      return 1;
    } catch (IOException | InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("Failed to submit application to Supabase REST.", e);
    }
  }

  private static String stripTrailingSlash(String input) {
    if (input == null) return "";
    return input.endsWith("/") ? input.substring(0, input.length() - 1) : input;
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private static String asString(JsonNode node) {
    if (node == null || node.isNull()) return null;
    return node.asText();
  }

  private static String escapeJson(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }
}

