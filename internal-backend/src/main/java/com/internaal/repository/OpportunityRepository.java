package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.TargetUniversityOption;
import com.internaal.entity.Opportunity;
import com.internaal.entity.TargetUniversity;
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
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Repository
public class OpportunityRepository {

    private static final Logger log = LoggerFactory.getLogger(OpportunityRepository.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OpportunityRepository(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Value("${supabase.service.role.key:}")
    private String supabaseServiceRoleKey;

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
     * Prefer service role so RLS on {@code university} does not block name resolution when embeds are empty.
     */
    private HttpHeaders universityLookupHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Content-Type", "application/json");
        if (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) {
            headers.set("apikey", supabaseServiceRoleKey);
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
            return headers;
        }
        return authHeaders();
    }

    private static String selectClause() {
        return "opportunity_id,company_id,code,title,description,"
                + "required_skills,required_experience,deadline,start_date,type,"
                + "position_count,job_location,work_mode,work_type,duration,salary_monthly,nice_to_have,"
                + "is_draft,is_paid,created_at,"
                + "company(name,location,university(name)),"
                + "opportunitytarget(university_id,university(name))";
    }

    /**
     * All opportunities for a company (sidebar / company dashboard).
     */
    public List<Opportunity> findForCompanyId(int companyId) {
        try {
            String url = supabaseUrl + "/rest/v1/opportunity?select=" + selectClause()
                    + "&company_id=eq." + companyId;
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(authHeaders()), String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray()) {
                return List.of();
            }
            List<Opportunity> result = new ArrayList<>();
            for (JsonNode node : array) {
                result.add(OpportunityMapper.fromJsonNode(node));
            }
            return enrichTargetUniversities(result);
        } catch (HttpStatusCodeException e) {
            String body = e.getResponseBodyAsString();
            String hint = body != null && body.length() > 500 ? body.substring(0, 500) + "…" : body;
            log.error("findForCompanyId HTTP {}: {}", e.getStatusCode().value(), hint);
            return List.of();
        } catch (Exception e) {
            log.error("findForCompanyId failed: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Single opportunity for a company if it exists and belongs to {@code companyId}.
     */
    public Optional<Opportunity> findByIdAndCompanyId(int opportunityId, int companyId) {
        try {
            String url = supabaseUrl + "/rest/v1/opportunity?select=" + selectClause()
                    + "&opportunity_id=eq." + opportunityId
                    + "&company_id=eq." + companyId
                    + "&limit=1";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(authHeaders()), String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray() || array.isEmpty()) {
                return Optional.empty();
            }
            Opportunity o = OpportunityMapper.fromJsonNode(array.get(0));
            return Optional.of(enrichTargetUniversities(List.of(o)).get(0));
        } catch (HttpStatusCodeException e) {
            String body = e.getResponseBodyAsString();
            String hint = body != null && body.length() > 500 ? body.substring(0, 500) + "…" : body;
            log.error("findByIdAndCompanyId HTTP {}: {}", e.getStatusCode().value(), hint);
            return Optional.empty();
        } catch (Exception e) {
            log.error("findByIdAndCompanyId failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Fetches opportunities visible to the student's university using Supabase REST API.
     * Embeds company (name + location) and opportunitytarget (university_id) via PostgREST.
     * Filtering by university, type, location, skills, and text search is done in Java.
     */
    public List<Opportunity> findForStudent(Integer studentUniversityId, OpportunityQuery query) {
        try {
            StringBuilder url = new StringBuilder(supabaseUrl);
            url.append("/rest/v1/opportunity?select=").append(selectClause());

            if (query.type() != null && !query.type().isBlank()) {
                url.append("&type=eq.").append(query.type().trim());
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
                Opportunity opp = OpportunityMapper.fromJsonNode(node);
                if (opp.draft()) {
                    continue;
                }
                if (query.type() != null && !query.type().isBlank() && !matchesApplicationType(opp, query.type())) {
                    continue;
                }
                if (matchesQuery(opp, node, query)) {
                    result.add(opp);
                }
            }
            return enrichTargetUniversities(result);

        } catch (Exception e) {
            log.error("findForStudent failed: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Single opportunity visible to a student (same rules as {@link #findForStudent}: university targeting, not draft).
     */
    public Optional<Opportunity> findVisibleForStudent(int opportunityId, Integer studentUniversityId) {
        try {
            String url = supabaseUrl + "/rest/v1/opportunity?select=" + selectClause()
                    + "&opportunity_id=eq." + opportunityId
                    + "&limit=1";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(authHeaders()), String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray() || array.isEmpty()) {
                return Optional.empty();
            }
            JsonNode node = array.get(0);
            if (!matchesUniversity(node, studentUniversityId)) {
                return Optional.empty();
            }
            Opportunity opp = OpportunityMapper.fromJsonNode(node);
            if (opp.draft()) {
                return Optional.empty();
            }
            return Optional.of(enrichTargetUniversities(List.of(opp)).get(0));
        } catch (HttpStatusCodeException e) {
            String body = e.getResponseBodyAsString();
            String hint = body != null && body.length() > 500 ? body.substring(0, 500) + "…" : body;
            log.error("findVisibleForStudent HTTP {}: {}", e.getStatusCode().value(), hint);
            return Optional.empty();
        } catch (Exception e) {
            log.error("findVisibleForStudent failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Opportunities for one company that a student may see (university targeting, not draft).
     */
    public List<Opportunity> findVisibleForStudentByCompany(int companyId, Integer studentUniversityId) {
        try {
            String url = supabaseUrl + "/rest/v1/opportunity?select=" + selectClause()
                    + "&company_id=eq." + companyId;
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(authHeaders()), String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray()) {
                return List.of();
            }
            List<Opportunity> result = new ArrayList<>();
            for (JsonNode node : array) {
                if (!matchesUniversity(node, studentUniversityId)) {
                    continue;
                }
                Opportunity opp = OpportunityMapper.fromJsonNode(node);
                if (opp.draft()) {
                    continue;
                }
                result.add(opp);
            }
            return enrichTargetUniversities(result);
        } catch (HttpStatusCodeException e) {
            String body = e.getResponseBodyAsString();
            String hint = body != null && body.length() > 500 ? body.substring(0, 500) + "…" : body;
            log.error("findVisibleForStudentByCompany HTTP {}: {}", e.getStatusCode().value(), hint);
            return List.of();
        } catch (Exception e) {
            log.error("findVisibleForStudentByCompany failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Opportunity> enrichTargetUniversities(List<Opportunity> rows) {
        if (rows == null || rows.isEmpty()) {
            return rows;
        }
        Set<Integer> missing = new LinkedHashSet<>();
        for (Opportunity o : rows) {
            if (o.targetUniversities() == null) {
                continue;
            }
            for (TargetUniversity t : o.targetUniversities()) {
                if (t.name() == null || t.name().isBlank()) {
                    missing.add(t.id());
                }
            }
        }
        if (missing.isEmpty()) {
            return rows;
        }
        Map<Integer, String> names = fetchUniversityNames(missing);
        if (names.isEmpty()) {
            log.warn(
                    "University name lookup returned no rows for ids {}. "
                            + "Verify PostgREST resource (university vs universities), PK column, and that "
                            + "SUPABASE_SERVICE_ROLE_KEY is set if RLS blocks reads. Service role configured: {}",
                    missing,
                    supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank());
            return rows;
        }
        List<Opportunity> out = new ArrayList<>(rows.size());
        for (Opportunity o : rows) {
            out.add(OpportunityMapper.enrichTargetUniversityNames(o, names));
        }
        return out;
    }

    private String restV1Root() {
        String base = supabaseUrl == null ? "" : supabaseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/rest/v1";
    }

    private Map<Integer, String> fetchUniversityNames(Collection<Integer> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        List<Integer> idList = ids.stream().distinct().sorted().toList();
        Map<Integer, String> merged = new LinkedHashMap<>();
        int chunkSize = 80;
        for (int i = 0; i < idList.size(); i += chunkSize) {
            List<Integer> chunk = idList.subList(i, Math.min(i + chunkSize, idList.size()));
            String inList = chunk.stream().map(String::valueOf).collect(Collectors.joining(","));
            merged.putAll(fetchUniversityNamesChunk(inList, chunk.size()));
        }
        return merged;
    }

    /**
     * Resolves names in order: (1) {@code opportunitytarget} + embedded {@code university(name)} — same path as
     * {@link #findDistinctUniversitiesFromOpportunityTargets()} which already works with your JWT; (2) direct
     * {@code university} GET with raw query strings (avoids PostgREST breaking on encoded {@code select}).
     */
    private Map<Integer, String> fetchUniversityNamesChunk(String inList, int expectedMax) {
        Map<Integer, String> merged = new LinkedHashMap<>();
        merged.putAll(queryUniversityNamesViaOpportunityTarget(inList, universityLookupHeaders()));
        if (merged.size() >= expectedMax) {
            return merged;
        }
        merged.putAll(queryUniversityNamesViaOpportunityTarget(inList, authHeaders()));
        if (merged.size() >= expectedMax) {
            return merged;
        }
        String[] tables = {"university", "universities"};
        String[] filterColumns = {"university_id", "id"};
        for (String table : tables) {
            for (String col : filterColumns) {
                merged.putAll(queryUniversityTableRaw(table, col, inList, universityLookupHeaders()));
                if (merged.size() >= expectedMax) {
                    return merged;
                }
                merged.putAll(queryUniversityTableRaw(table, col, inList, authHeaders()));
                if (merged.size() >= expectedMax) {
                    return merged;
                }
            }
        }
        return merged;
    }

    /**
     * Uses FK embed from {@code opportunitytarget} → {@code university}; often allowed by RLS when direct
     * {@code GET /university} is not.
     */
    private Map<Integer, String> queryUniversityNamesViaOpportunityTarget(String inList, HttpHeaders headers) {
        Map<Integer, String> out = new LinkedHashMap<>();
        if (inList.isBlank()) {
            return out;
        }
        try {
            String url = restV1Root() + "/opportunitytarget?select=university_id,university(name)&university_id=in.("
                    + inList + ")";
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array != null && array.isArray()) {
                for (JsonNode row : array) {
                    putUniversityNameFromOpportunityTargetRow(row, out);
                }
            }
        } catch (HttpStatusCodeException e) {
            log.debug(
                    "opportunitytarget university embed lookup -> {}: {}",
                    e.getStatusCode(),
                    truncateForLog(e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.debug("opportunitytarget university embed lookup: {}", e.getMessage());
        }
        return out;
    }

    private static void putUniversityNameFromOpportunityTargetRow(JsonNode row, Map<Integer, String> out) {
        if (!row.has("university_id") || row.get("university_id").isNull()) {
            return;
        }
        int uid = row.get("university_id").asInt();
        JsonNode u = row.get("university");
        if (u == null || u.isNull()) {
            return;
        }
        JsonNode uni = u.isArray() && !u.isEmpty() ? u.get(0) : u;
        if (uni == null || uni.isNull()) {
            return;
        }
        String name = pickUniversityDisplayName(uni);
        if (name != null && !name.isBlank()) {
            out.putIfAbsent(uid, name.trim());
        }
    }

    private Map<Integer, String> queryUniversityTableRaw(String table, String filterColumn, String inList, HttpHeaders headers) {
        if (inList.isBlank()) {
            return Map.of();
        }
        String select = "university_id".equals(filterColumn) ? "university_id,name" : "id,name";
        try {
            String url = restV1Root() + "/" + table + "?select=" + select + "&" + filterColumn + "=in.(" + inList + ")";
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            return parseUniversityNameRows(array);
        } catch (HttpStatusCodeException e) {
            log.debug(
                    "GET {}/{} -> {}: {}",
                    table,
                    filterColumn,
                    e.getStatusCode(),
                    truncateForLog(e.getResponseBodyAsString()));
            return Map.of();
        } catch (Exception e) {
            log.debug("GET {}/{}: {}", table, filterColumn, e.getMessage());
            return Map.of();
        }
    }

    private static String truncateForLog(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        return body.length() > 280 ? body.substring(0, 280) + "…" : body;
    }

    private static Map<Integer, String> parseUniversityNameRows(JsonNode array) {
        Map<Integer, String> out = new LinkedHashMap<>();
        if (array == null || !array.isArray()) {
            return out;
        }
        for (JsonNode row : array) {
            Integer pk = OpportunityMapper.intVal(row, "university_id");
            if (pk == null) {
                pk = OpportunityMapper.intVal(row, "id");
            }
            if (pk == null) {
                continue;
            }
            String nm = pickUniversityDisplayName(row);
            if (nm != null && !nm.isBlank()) {
                out.putIfAbsent(pk, nm.trim());
            }
        }
        return out;
    }

    private static String pickUniversityDisplayName(JsonNode row) {
        for (String key : List.of(
                "name",
                "university_name",
                "school_name",
                "institution_name",
                "title",
                "label",
                "full_name",
                "display_name",
                "legal_name")) {
            String s = OpportunityMapper.str(row, key);
            if (s != null && !s.isBlank()) {
                return s.trim();
            }
        }
        return null;
    }

    /** Student filter: when {@code type} query param is set, require equal {@code opportunity.type} (case-insensitive). */
    private static boolean matchesApplicationType(Opportunity opp, String filterType) {
        String f = filterType.trim();
        String ot = opp.type();
        return ot != null && !ot.isBlank() && ot.trim().equalsIgnoreCase(f);
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

        if (query.paid() != null && opp.isPaid() != null && !query.paid().equals(opp.isPaid())) {
            return false;
        }

        if (query.workMode() != null && !query.workMode().isBlank() && opp.workMode() != null) {
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
            String nice = opp.niceToHave() != null ? opp.niceToHave().toLowerCase(Locale.ROOT) : "";
            String skillsLower = String.join(" ", opp.requiredSkills()).toLowerCase(Locale.ROOT);
            if (!title.contains(term)
                    && !desc.contains(term)
                    && !skillsLower.contains(term)
                    && !location.contains(term)
                    && !companyName.contains(term)
                    && !experience.contains(term)
                    && !nice.contains(term)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Returns universities directly from the university table (not filtered by opportunitytarget).
     */
    public List<TargetUniversityOption> findUniversitiesFromUniversityTable() {
        String[] tables = {"university", "universities"};
        String[] idColumns = {"university_id", "id"};
        HttpHeaders[] headers = {universityLookupHeaders(), authHeaders()};
        String[] nameColumns = {
                "name",
                "university_name",
                "school_name",
                "institution_name",
                "title",
                "label",
                "full_name",
                "display_name",
                "legal_name"
        };

        Map<Integer, String> merged = new LinkedHashMap<>();
        for (String table : tables) {
            for (String idColumn : idColumns) {
                for (HttpHeaders h : headers) {
                    for (String nameColumn : nameColumns) {
                        try {
                            String select = idColumn + "," + nameColumn;
                            String url = restV1Root() + "/" + table + "?select=" + select + "&order=" + idColumn + ".asc";
                            ResponseEntity<String> response = restTemplate.exchange(
                                    url,
                                    HttpMethod.GET,
                                    new HttpEntity<>(h),
                                    String.class);
                            JsonNode array = objectMapper.readTree(response.getBody());
                            if (array == null || !array.isArray()) {
                                break;
                            }
                            // No rows: same for any name column with this table/id/auth — stop inner loop.
                            if (array.isEmpty()) {
                                break;
                            }
                            Map<Integer, String> parsed = parseUniversityNameRows(array);
                            if (!parsed.isEmpty()) {
                                parsed.forEach(merged::putIfAbsent);
                                // Columns exist and we got id+name pairs; other name columns won't add more.
                                break;
                            }
                            // 200 with rows but no usable id+name (e.g. name column empty, name lives in another field).
                            log.debug(
                                    "GET all universities returned {} rows but none parsed for {}/{} (try next name column)",
                                    array.size(),
                                    table,
                                    idColumn);
                        } catch (HttpStatusCodeException e) {
                            log.debug(
                                    "GET all universities {}/{}/{} -> {}: {}",
                                    table,
                                    idColumn,
                                    nameColumn,
                                    e.getStatusCode(),
                                    truncateForLog(e.getResponseBodyAsString()));
                        } catch (Exception e) {
                            log.debug("GET all universities {}/{}/{}: {}", table, idColumn, nameColumn, e.getMessage());
                        }
                    }
                }
            }
        }

        if (merged.isEmpty()) {
            log.warn(
                    "findUniversitiesFromUniversityTable: no rows parsed. If universities exist in the DB, check "
                            + "RLS policies on public.university and set supabase.service.role.key so the backend can read them.");
        }

        return merged.entrySet().stream()
                .map(e -> new TargetUniversityOption(e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(TargetUniversityOption::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /**
     * Distinct {@code university_id} values in {@code opportunitytarget}, with optional embedded {@code university.name}.
     */
    public List<TargetUniversityOption> findDistinctUniversitiesFromOpportunityTargets() {
        try {
            String url = restV1Root() + "/opportunitytarget?select=university_id,university(name)";
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(authHeaders()), String.class);
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array == null || !array.isArray()) {
                return List.of();
            }
            Set<Integer> allUids = new LinkedHashSet<>();
            Map<Integer, String> byId = new LinkedHashMap<>();
            for (JsonNode row : array) {
                if (!row.has("university_id") || row.get("university_id").isNull()) {
                    continue;
                }
                int uid = row.get("university_id").asInt();
                allUids.add(uid);
                String name = null;
                JsonNode u = row.get("university");
                if (u != null && !u.isNull()) {
                    JsonNode uni = u.isArray() && !u.isEmpty() ? u.get(0) : u;
                    if (uni != null && !uni.isNull()) {
                        name = pickUniversityDisplayName(uni);
                    }
                }
                if (name != null && !name.isBlank()) {
                    byId.putIfAbsent(uid, name.trim());
                }
            }
            Set<Integer> missingNames = new LinkedHashSet<>();
            for (Integer uid : allUids) {
                String v = byId.get(uid);
                if (v == null || v.isBlank()) {
                    missingNames.add(uid);
                }
            }
            if (!missingNames.isEmpty()) {
                Map<Integer, String> fetched = fetchUniversityNames(missingNames);
                for (Integer uid : missingNames) {
                    String r = fetched.get(uid);
                    byId.put(uid, (r != null && !r.isBlank()) ? r : ("University " + uid));
                }
            }
            return byId.entrySet().stream()
                    .map(e -> new TargetUniversityOption(e.getKey(), e.getValue()))
                    .sorted(Comparator.comparing(TargetUniversityOption::name, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        } catch (Exception e) {
            log.error("findDistinctUniversitiesFromOpportunityTargets failed: {}", e.getMessage());
            return List.of();
        }
    }
}
