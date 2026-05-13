package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.SystemAdminAnalyticsResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpStatusCodeException;

import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
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
public class SystemAdminAnalyticsRepository {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;

    public SystemAdminAnalyticsRepository(
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

    public SystemAdminAnalyticsResponse analytics(Integer universityId, Integer companyId, String granularity, String range) {
        String bucket = normalizeGranularity(granularity);
        LocalDate startDate = startDateForRange(range);
        List<ApplicationRow> applications = loadApplications(universityId, companyId, startDate);
        List<OpportunityRow> opportunities = loadOpportunities(universityId, companyId, startDate);

        Map<String, Integer> statusCounts = new LinkedHashMap<>();
        statusCounts.put("Waiting", 0);
        statusCounts.put("Approved by PPA", 0);
        statusCounts.put("Approved by Company", 0);
        statusCounts.put("Fully Approved", 0);
        statusCounts.put("Rejected", 0);

        Map<String, Integer> typeCounts = new LinkedHashMap<>();
        typeCounts.put("Professional Practice", 0);
        typeCounts.put("Individual Growth", 0);

        int approved = 0;
        int rejected = 0;
        Map<String, Integer> applicationTrend = seedBuckets(bucket);
        for (ApplicationRow row : applications) {
            String status = statusLabel(row);
            statusCounts.computeIfPresent(status, (k, v) -> v + 1);
            if ("Rejected".equals(status)) {
                rejected++;
            } else if (!"Waiting".equals(status)) {
                approved++;
            }
            String typeLabel = applicationTypeLabel(row.applicationType());
            typeCounts.computeIfPresent(typeLabel, (k, v) -> v + 1);
            incrementBucket(applicationTrend, bucket, row.createdAt());
        }

        Map<String, Integer> opportunityTrend = seedBuckets(bucket);
        for (OpportunityRow row : opportunities) {
            incrementBucket(opportunityTrend, bucket, row.createdAt());
        }

        Set<String> allTrendLabels = new LinkedHashSet<>();
        allTrendLabels.addAll(opportunityTrend.keySet());
        allTrendLabels.addAll(applicationTrend.keySet());
        List<String> orderedLabels = allTrendLabels.stream()
                .sorted(Comparator.comparing(SystemAdminAnalyticsRepository::sortKeyForBucket))
                .toList();

        int totalApplications = applications.size();
        int totalUniversities = universityId == null ? countRows("university", "university_id", null) : 1;
        int totalCompanies = companyId == null ? countRows("company", "company_id", null) : 1;

        return new SystemAdminAnalyticsResponse(
                new SystemAdminAnalyticsResponse.Summary(
                        totalUniversities,
                        totalCompanies,
                        opportunities.size(),
                        totalApplications),
                toChartPoints(statusCounts),
                toChartPoints(applicationTrend),
                orderedLabels.stream()
                        .map(label -> new SystemAdminAnalyticsResponse.OpportunityApplicationPoint(
                                label,
                                opportunityTrend.getOrDefault(label, 0),
                                applicationTrend.getOrDefault(label, 0)))
                        .toList(),
                toChartPoints(typeCounts),
                new SystemAdminAnalyticsResponse.ApprovalRate(
                        approved,
                        rejected,
                        totalApplications,
                        percentage(approved, totalApplications),
                        percentage(rejected, totalApplications))
        );
    }

    private List<ApplicationRow> loadApplications(Integer universityId, Integer companyId, LocalDate startDate) {
        StringBuilder url = new StringBuilder(restRoot())
                .append("/application?select=application_id,student_id,company_id,application_type,created_at,is_approved_by_ppa,is_approved_by_company,student(university_id)")
                .append("&order=created_at.asc")
                .append("&limit=5000");
        if (companyId != null) {
            url.append("&company_id=eq.").append(companyId);
        }
        Optional<JsonNode> arr = fetchArray(url.toString());
        if (arr.isEmpty()) {
            StringBuilder fallbackUrl = new StringBuilder(restRoot())
                    .append("/application?select=application_id,student_id,company_id,application_type,created_at,is_approved_by_ppa,is_approved_by_company")
                    .append("&order=created_at.asc")
                    .append("&limit=5000");
            if (companyId != null) {
                fallbackUrl.append("&company_id=eq.").append(companyId);
            }
            arr = fetchArray(fallbackUrl.toString());
        }
        if (arr.isEmpty() || !arr.get().isArray()) {
            return List.of();
        }

        List<ApplicationRow> rows = new ArrayList<>();
        Set<Integer> studentIdsNeedingUniversity = new LinkedHashSet<>();
        for (JsonNode node : arr.get()) {
            Integer studentId = intVal(node, "student_id");
            Integer embeddedUniversityId = readEmbeddedUniversityId(node.get("student"));
            if (universityId != null && embeddedUniversityId == null && studentId != null) {
                studentIdsNeedingUniversity.add(studentId);
            }
            rows.add(new ApplicationRow(
                    intVal(node, "application_id"),
                    studentId,
                    intVal(node, "company_id"),
                    embeddedUniversityId,
                    text(node, "application_type"),
                    text(node, "created_at"),
                    boolVal(node, "is_approved_by_ppa"),
                    boolVal(node, "is_approved_by_company")
            ));
        }

        Map<Integer, Integer> universityByStudentId = studentIdsNeedingUniversity.isEmpty()
                ? Map.of()
                : fetchUniversityByStudentIds(studentIdsNeedingUniversity);

        if (universityId == null) {
            return filterApplicationsByDate(rows, startDate);
        }
        return filterApplicationsByDate(rows, startDate).stream()
                .filter(row -> {
                    Integer actualUniversityId = row.universityId() != null
                            ? row.universityId()
                            : universityByStudentId.get(row.studentId());
                    return universityId.equals(actualUniversityId);
                })
                .toList();
    }

    private List<OpportunityRow> loadOpportunities(Integer universityId, Integer companyId, LocalDate startDate) {
        StringBuilder url = new StringBuilder(restRoot())
                .append("/opportunity?select=opportunity_id,company_id,created_at,opportunitytarget(university_id)")
                .append("&order=created_at.asc")
                .append("&limit=5000");
        if (companyId != null) {
            url.append("&company_id=eq.").append(companyId);
        }
        Optional<JsonNode> arr = fetchArray(url.toString());
        if (arr.isEmpty()) {
            StringBuilder fallbackUrl = new StringBuilder(restRoot())
                    .append("/opportunity?select=opportunity_id,company_id,created_at")
                    .append("&order=created_at.asc")
                    .append("&limit=5000");
            if (companyId != null) {
                fallbackUrl.append("&company_id=eq.").append(companyId);
            }
            arr = fetchArray(fallbackUrl.toString());
        }
        if (arr.isEmpty() || !arr.get().isArray()) {
            return List.of();
        }
        List<OpportunityRow> rows = new ArrayList<>();
        for (JsonNode node : arr.get()) {
            List<Integer> targetUniversities = new ArrayList<>();
            JsonNode targets = node.get("opportunitytarget");
            if (targets != null && targets.isArray()) {
                for (JsonNode target : targets) {
                    Integer targetId = intVal(target, "university_id");
                    if (targetId != null) {
                        targetUniversities.add(targetId);
                    }
                }
            }
            if (universityId != null && !targetUniversities.isEmpty() && !targetUniversities.contains(universityId)) {
                continue;
            }
            rows.add(new OpportunityRow(
                    intVal(node, "opportunity_id"),
                    intVal(node, "company_id"),
                    text(node, "created_at"),
                    targetUniversities
            ));
        }
        return filterOpportunitiesByDate(rows, startDate);
    }

    private Map<Integer, Integer> fetchUniversityByStudentIds(Set<Integer> studentIds) {
        if (studentIds == null || studentIds.isEmpty()) {
            return Map.of();
        }
        String idList = studentIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        Optional<JsonNode> arr = fetchArray(restRoot() + "/student?student_id=in.(" + idList + ")&select=student_id,university_id&limit=5000");
        if (arr.isEmpty() || !arr.get().isArray()) {
            return Map.of();
        }
        Map<Integer, Integer> out = new LinkedHashMap<>();
        for (JsonNode row : arr.get()) {
            Integer studentId = intVal(row, "student_id");
            Integer uid = intVal(row, "university_id");
            if (studentId != null && uid != null) {
                out.put(studentId, uid);
            }
        }
        return out;
    }

    private int countRows(String table, String idColumn, String extraFilter) {
        String url = restRoot() + "/" + table + "?select=" + idColumn + "&limit=5000";
        if (extraFilter != null && !extraFilter.isBlank()) {
            url += "&" + extraFilter;
        }
        Optional<JsonNode> arr = fetchArray(url);
        return arr.filter(JsonNode::isArray).map(JsonNode::size).orElse(0);
    }

    private Optional<JsonNode> fetchArray(String rawUrl) {
        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                    encodeUrl(rawUrl),
                    HttpMethod.GET,
                    new HttpEntity<>(serviceHeaders()),
                    String.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                return Optional.of(objectMapper.readTree(resp.getBody()));
            }
        } catch (HttpStatusCodeException ignored) {
            /* empty */
        } catch (Exception ignored) {
            /* empty */
        }
        return Optional.empty();
    }

    private HttpHeaders serviceHeaders() {
        String key = serviceRoleKey != null && !serviceRoleKey.isBlank() ? serviceRoleKey : anonKey;
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private String restRoot() {
        String base = supabaseUrl == null ? "" : supabaseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/rest/v1";
    }

    private static List<SystemAdminAnalyticsResponse.ChartPoint> toChartPoints(Map<String, Integer> values) {
        return values.entrySet().stream()
                .map(e -> new SystemAdminAnalyticsResponse.ChartPoint(e.getKey(), e.getValue()))
                .toList();
    }

    private static String statusLabel(ApplicationRow row) {
        if (Boolean.FALSE.equals(row.approvedByPpa()) || Boolean.FALSE.equals(row.approvedByCompany())) {
            return "Rejected";
        }
        if (Boolean.TRUE.equals(row.approvedByPpa()) && Boolean.TRUE.equals(row.approvedByCompany())) {
            return "Fully Approved";
        }
        if (Boolean.TRUE.equals(row.approvedByPpa())) {
            return "Approved by PPA";
        }
        if (Boolean.TRUE.equals(row.approvedByCompany())) {
            return "Approved by Company";
        }
        return "Waiting";
    }

    private static String applicationTypeLabel(String type) {
        String normalized = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        if ("INDIVIDUAL_GROWTH".equals(normalized) || "INDIVIDUAL GROWTH".equals(normalized)) {
            return "Individual Growth";
        }
        return "Professional Practice";
    }

    private static Map<String, Integer> seedBuckets(String granularity) {
        Map<String, Integer> out = new LinkedHashMap<>();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if ("daily".equals(granularity)) {
            for (int i = 6; i >= 0; i--) {
                out.put(today.minusDays(i).format(DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH)), 0);
            }
        } else if ("monthly".equals(granularity)) {
            for (int i = 5; i >= 0; i--) {
                out.put(today.minusMonths(i).format(DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH)), 0);
            }
        } else {
            for (int i = 3; i >= 0; i--) {
                LocalDate d = today.minusWeeks(i);
                out.put("Week " + d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR), 0);
            }
        }
        return out;
    }

    private static void incrementBucket(Map<String, Integer> buckets, String granularity, String createdAt) {
        LocalDate date = parseDate(createdAt);
        if (date == null) {
            return;
        }
        String label = labelForDate(date, granularity);
        buckets.merge(label, 1, Integer::sum);
    }

    private static String labelForDate(LocalDate date, String granularity) {
        if ("daily".equals(granularity)) {
            return date.format(DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH));
        }
        if ("monthly".equals(granularity)) {
            return date.format(DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH));
        }
        return "Week " + date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value).atZone(ZoneOffset.UTC).toLocalDate();
        } catch (Exception ignored) {
            try {
                return LocalDate.parse(value.substring(0, Math.min(10, value.length())));
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    private static String normalizeGranularity(String granularity) {
        String value = granularity == null ? "" : granularity.trim().toLowerCase(Locale.ROOT);
        if ("daily".equals(value) || "monthly".equals(value)) {
            return value;
        }
        return "weekly";
    }

    private static LocalDate startDateForRange(String range) {
        String value = range == null ? "" : range.trim().toLowerCase(Locale.ROOT);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if ("monthly".equals(value)) {
            return today.withDayOfMonth(1);
        }
        if ("yearly".equals(value)) {
            return today.withDayOfYear(1);
        }
        return null;
    }

    private static List<ApplicationRow> filterApplicationsByDate(List<ApplicationRow> rows, LocalDate startDate) {
        if (startDate == null) {
            return rows;
        }
        return rows.stream()
                .filter(row -> {
                    LocalDate created = parseDate(row.createdAt());
                    return created != null && !created.isBefore(startDate);
                })
                .toList();
    }

    private static List<OpportunityRow> filterOpportunitiesByDate(List<OpportunityRow> rows, LocalDate startDate) {
        if (startDate == null) {
            return rows;
        }
        return rows.stream()
                .filter(row -> {
                    LocalDate created = parseDate(row.createdAt());
                    return created != null && !created.isBefore(startDate);
                })
                .toList();
    }

    private static int percentage(int value, int total) {
        if (total <= 0) {
            return 0;
        }
        return Math.round((value * 100f) / total);
    }

    private static String sortKeyForBucket(String label) {
        return label == null ? "" : label;
    }

    private static Integer readEmbeddedUniversityId(JsonNode student) {
        JsonNode node = firstEmbed(student);
        if (node == null || node.isNull()) {
            return null;
        }
        return intVal(node, "university_id");
    }

    private static JsonNode firstEmbed(JsonNode embed) {
        if (embed == null || embed.isNull()) {
            return null;
        }
        if (embed.isArray()) {
            return embed.isEmpty() ? null : embed.get(0);
        }
        return embed;
    }

    private static Integer intVal(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        JsonNode v = n.get(field);
        return v.isNumber() ? v.asInt() : null;
    }

    private static Boolean boolVal(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        return n.get(field).asBoolean();
    }

    private static String text(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        return n.get(field).asText();
    }

    private static String encodeUrl(String rawUrl) {
        String[] parts = rawUrl.split("\\?", 2);
        if (parts.length < 2) {
            return rawUrl;
        }
        String query = parts[1].replace(" ", "%20");
        return parts[0] + "?" + query;
    }

    private record ApplicationRow(
            Integer applicationId,
            Integer studentId,
            Integer companyId,
            Integer universityId,
            String applicationType,
            String createdAt,
            Boolean approvedByPpa,
            Boolean approvedByCompany
    ) {
    }

    private record OpportunityRow(
            Integer opportunityId,
            Integer companyId,
            String createdAt,
            List<Integer> targetUniversityIds
    ) {
    }
}
