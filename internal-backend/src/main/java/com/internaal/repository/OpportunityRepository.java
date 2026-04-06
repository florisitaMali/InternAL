package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.entity.Opportunity;
import com.internaal.service.OpportunityQuery;
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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Repository
public class OpportunityRepository {

    private static final Logger log = LoggerFactory.getLogger(OpportunityRepository.class);

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

    /**
     * Fetches opportunities visible to the student's university using Supabase REST API.
     * Embeds company (name + location) and opportunitytarget (university_id) via PostgREST.
     * Filtering by university, type, location, skills, and text search is done in Java.
     */
    public List<Opportunity> findForStudent(Integer studentUniversityId, OpportunityQuery query) {
        try {
            StringBuilder url = new StringBuilder(supabaseUrl);
            url.append("/rest/v1/opportunity?select=opportunity_id,company_id,code,title,description,")
               .append("required_skills,required_experience,deadline,type,is_paid,work_mode,")
               .append("company(name,location),")
               .append("opportunitytarget(university_id)");

            if (query.type() != null) {
                url.append("&type=eq.").append(query.type().name());
            }

            ResponseEntity<String> response = restTemplate.exchange(
                    url.toString(), HttpMethod.GET, new HttpEntity<>(authHeaders()), String.class);

            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray()) {
                return List.of();
            }

            List<Opportunity> result = new ArrayList<>();
            for (JsonNode node : array) {
                if (!matchesUniversity(node, studentUniversityId)) {
                    continue;
                }
                Opportunity opp = mapOpportunity(node);
                if (matchesQuery(opp, node, query)) {
                    result.add(opp);
                }
            }
            return result;

        } catch (Exception e) {
            log.error("findForStudent failed: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Returns true when the opportunity is open to all universities (no rows in opportunitytarget)
     * OR explicitly targets the student's university.
     */
    private boolean matchesUniversity(JsonNode node, Integer studentUniversityId) {
        JsonNode targets = node.get("opportunitytarget");
        if (targets == null || targets.isNull() || !targets.isArray() || targets.isEmpty()) {
            return true;
        }
        for (JsonNode t : targets) {
            if (t.has("university_id") && !t.get("university_id").isNull()
                    && t.get("university_id").asInt() == studentUniversityId) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesQuery(Opportunity opp, JsonNode node, OpportunityQuery query) {
        if (query.location() != null && !query.location().isBlank()) {
            String loc = opp.location();
            String requestedLocation = query.location().trim().toLowerCase(Locale.ROOT);
            if (loc == null || !loc.trim().toLowerCase(Locale.ROOT).contains(requestedLocation)) {
                return false;
            }
        }

        if (query.skills() != null && !query.skills().isEmpty()) {
            List<String> requiredSkills = opp.requiredSkills() == null ? List.of() : opp.requiredSkills();
            for (String skill : query.skills()) {
                if (skill != null && !skill.isBlank()) {
                    String requestedSkill = skill.trim().toLowerCase(Locale.ROOT);
                    boolean hasMatch = requiredSkills.stream()
                            .filter(required -> required != null && !required.isBlank())
                            .map(required -> required.toLowerCase(Locale.ROOT))
                            .anyMatch(required -> required.contains(requestedSkill));
                    if (!hasMatch) {
                        return false;
                    }
                }
            }
        }

        if (query.paid() != null && !query.paid().equals(opp.isPaid())) {
            return false;
        }

        if (query.workMode() != null && !query.workMode().isBlank()) {
            Opportunity.WorkMode requestedWorkMode = Opportunity.WorkMode.fromDb(query.workMode());
            if (requestedWorkMode == null || opp.workMode() != requestedWorkMode) {
                return false;
            }
        }

        if (query.q() != null && !query.q().isBlank()) {
            String term = query.q().trim().toLowerCase(Locale.ROOT);
            String title = opp.title() != null ? opp.title().toLowerCase(Locale.ROOT) : "";
            String desc = opp.description() != null ? opp.description().toLowerCase(Locale.ROOT) : "";
            String location = opp.location() != null ? opp.location().toLowerCase(Locale.ROOT) : "";
            String companyName = opp.companyName() != null ? opp.companyName().toLowerCase(Locale.ROOT) : "";
            String experience = opp.requiredExperience() != null ? opp.requiredExperience().toLowerCase(Locale.ROOT) : "";
            String skillsLower = String.join(" ", opp.requiredSkills()).toLowerCase(Locale.ROOT);
            if (!title.contains(term)
                    && !desc.contains(term)
                    && !skillsLower.contains(term)
                    && !location.contains(term)
                    && !companyName.contains(term)
                    && !experience.contains(term)) {
                return false;
            }
        }

        return true;
    }

    private Opportunity mapOpportunity(JsonNode node) {
        Integer id = intVal(node, "opportunity_id");
        Integer companyId = intVal(node, "company_id");

        JsonNode company = node.get("company");
        String companyName = null;
        String location = null;
        if (company != null && !company.isNull()) {
            companyName = str(company, "name");
            location = str(company, "location");
        }

        String title = str(node, "title");
        String description = str(node, "description");
        List<String> requiredSkills = splitCsv(str(node, "required_skills"));
        String requiredExperience = str(node, "required_experience");

        LocalDate deadline = null;
        String deadlineStr = str(node, "deadline");
        if (deadlineStr != null) {
            try {
                deadline = LocalDate.parse(deadlineStr);
            } catch (Exception ignored) {}
        }

        List<Integer> targetUniversities = new ArrayList<>();
        JsonNode targets = node.get("opportunitytarget");
        if (targets != null && targets.isArray()) {
            for (JsonNode t : targets) {
                Integer uid = intVal(t, "university_id");
                if (uid != null) {
                    targetUniversities.add(uid);
                }
            }
        }

        Opportunity.InternshipType type = null;
        String typeStr = str(node, "type");
        if (typeStr != null && !typeStr.isBlank()) {
            try {
                type = Opportunity.InternshipType.valueOf(typeStr.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {}
        }

        Boolean isPaid = node.has("is_paid") && !node.get("is_paid").isNull()
                ? node.get("is_paid").asBoolean()
                : null;
        Opportunity.WorkMode workMode = Opportunity.WorkMode.fromDb(str(node, "work_mode"));

        return new Opportunity(
                id, companyId, companyName, title, description,
                requiredSkills, requiredExperience, deadline,
                targetUniversities, type, location, isPaid, workMode);
    }

    private static String str(JsonNode node, String field) {
        return (node != null && node.has(field) && !node.get(field).isNull())
                ? node.get(field).asText()
                : null;
    }

    private static Integer intVal(JsonNode node, String field) {
        return (node != null && node.has(field) && !node.get(field).isNull())
                ? node.get(field).asInt()
                : null;
    }

    private static List<String> splitCsv(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        List<String> out = new ArrayList<>();
        for (String s : raw.split(",")) {
            if (s != null && !s.isBlank()) out.add(s.trim());
        }
        return out;
    }
}
