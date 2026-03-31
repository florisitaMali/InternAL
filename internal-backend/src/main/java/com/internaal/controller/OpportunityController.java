package com.internaal.controller;

import com.internaal.service.OpportunityService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/opportunities")
public class OpportunityController {

  private final OpportunityService opportunityService;

  public OpportunityController(OpportunityService opportunityService) {
    this.opportunityService = opportunityService;
  }

  @GetMapping
  public List<Map<String, Object>> list() {
    return opportunityService.findAll();
  }

  @PostMapping("/apply")
  public Map<String, Object> apply(@RequestBody Map<String, Object> payload) {
    // Temporary requirement: force student_id=1 until login flow is integrated.
    Integer studentId = 1;
    Integer companyId = toInteger(payload.get("companyId"));
    Integer opportunityId = toInteger(payload.get("opportunityId"));
    String applicationType = payload.get("applicationType") != null
        ? String.valueOf(payload.get("applicationType"))
        : "";
    Boolean accuracyConfirmed = payload.get("accuracyConfirmed") != null
        ? Boolean.valueOf(String.valueOf(payload.get("accuracyConfirmed")))
        : Boolean.FALSE;

    if (companyId == null || opportunityId == null || applicationType.isBlank()) {
      throw new IllegalArgumentException("companyId, opportunityId, and applicationType are required.");
    }

    int rows = opportunityService.submitApplication(
        studentId,
        companyId,
        opportunityId,
        applicationType,
        accuracyConfirmed
    );

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("success", rows > 0);
    response.put("rowsAffected", rows);
    return response;
  }

  private Integer toInteger(Object value) {
    if (value == null) return null;
    try {
      return Integer.valueOf(String.valueOf(value));
    } catch (NumberFormatException ignored) {
      return null;
    }
  }
}

