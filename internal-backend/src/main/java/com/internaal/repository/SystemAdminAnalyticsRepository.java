package com.internaal.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internaal.dto.SystemAdminAnalyticsResponse;
import com.internaal.dto.SystemAdminStudentAnalyticsResponse;
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
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
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
        String bucket = bucketForRange(range, granularity);
        LocalDate startDate = startDateForRange(range);
        List<ApplicationRow> applications = loadApplications(universityId, companyId, startDate);
        List<OpportunityRow> opportunities = loadOpportunities(universityId, companyId, startDate);

        Map<String, Integer> ppStatusCounts = new LinkedHashMap<>();
        ppStatusCounts.put("Pending PPA", 0);
        ppStatusCounts.put("Approved by PPA", 0);
        ppStatusCounts.put("Fully Approved", 0);
        ppStatusCounts.put("Rejected", 0);

        Map<String, Integer> igStatusCounts = new LinkedHashMap<>();
        igStatusCounts.put("Pending", 0);
        igStatusCounts.put("Approved", 0);
        igStatusCounts.put("Rejected", 0);

        Map<String, Integer> typeCounts = new LinkedHashMap<>();
        typeCounts.put("Professional Practice", 0);
        typeCounts.put("Individual Growth", 0);

        int approved = 0;
        int rejected = 0;
        Map<String, Integer> applicationTrend = seedBuckets(bucket);
        for (ApplicationRow row : applications) {
            String status = statusLabel(row);
            if ("Rejected".equals(status)) {
                rejected++;
            } else if (!"Waiting".equals(status)) {
                approved++;
            }
            String typeLabel = applicationTypeLabel(row.applicationType());
            typeCounts.computeIfPresent(typeLabel, (k, v) -> v + 1);
            if ("Individual Growth".equals(typeLabel)) {
                igStatusCounts.merge(igStatus(row), 1, Integer::sum);
            } else {
                ppStatusCounts.merge(ppStatus(row), 1, Integer::sum);
            }
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
                .sorted(Comparator.comparing(label -> sortKeyForBucket(label, bucket)))
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
                toChartPoints(ppStatusCounts),
                toChartPoints(igStatusCounts),
                toChartPoints(orderedValues(applicationTrend, orderedLabels)),
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

    /**
     * Student / subscription analytics (US-32). Sourced from {@code studentsubscription}
     * (one row per student — Base by default, Premium once subscribed) and {@code application}.
     *
     * @param subscriptionTier optional {@code BASE} / {@code PREMIUM} filter
     * @param billingCycle     optional {@code MONTHLY} / {@code YEARLY} filter
     */
    public SystemAdminStudentAnalyticsResponse studentAnalytics(
            Integer universityId, String subscriptionTier, String billingCycle, String granularity, String range) {
        String bucket = bucketForRange(range, granularity);
        LocalDate startDate = startDateForRange(range);

        String tierFilter = normalizeUpper(subscriptionTier);
        String cycleFilter = normalizeUpper(billingCycle);

        List<SubscriptionRow> subscriptions = loadSubscriptions(universityId).stream()
                .filter(s -> tierFilter.isEmpty() || tierFilter.equals(tierOf(s)))
                .filter(s -> cycleFilter.isEmpty() || cycleFilter.equals(rawCycle(s)))
                .toList();

        // studentId -> tier, for splitting the application-status pies.
        Map<Integer, String> tierByStudent = new LinkedHashMap<>();
        for (SubscriptionRow s : subscriptions) {
            if (s.studentId() != null) {
                tierByStudent.put(s.studentId(), tierOf(s));
            }
        }

        // ---- Summary, tier pie, billing-cycle pie (current snapshot) ----
        int baseStudents = 0;
        int premiumStudents = 0;
        double totalRevenue = 0;
        Map<String, Integer> cycleCounts = new LinkedHashMap<>();
        cycleCounts.put("Monthly", 0);
        cycleCounts.put("Yearly", 0);
        for (SubscriptionRow s : subscriptions) {
            if (isPremium(s)) {
                premiumStudents++;
                totalRevenue += priceOf(s);
                cycleCounts.merge("YEARLY".equals(rawCycle(s)) ? "Yearly" : "Monthly", 1, Integer::sum);
            } else {
                baseStudents++;
            }
        }
        Map<String, Integer> tierCounts = new LinkedHashMap<>();
        tierCounts.put("Base", baseStudents);
        tierCounts.put("Premium", premiumStudents);

        // ---- Application-status pies, split by the student's tier ----
        List<ApplicationRow> applications = loadApplications(universityId, null, startDate);
        Map<String, Integer> baseStatus = seedStatusBuckets();
        Map<String, Integer> premiumStatus = seedStatusBuckets();
        for (ApplicationRow a : applications) {
            String tier = tierByStudent.get(a.studentId());
            if (tier == null) {
                if (!tierFilter.isEmpty()) {
                    continue; // student outside the active tier filter
                }
                tier = "BASE"; // no subscription row -> treat as Base
            }
            String status = threeWayStatus(a);
            (("PREMIUM".equals(tier)) ? premiumStatus : baseStatus).merge(status, 1, Integer::sum);
        }

        // ---- Trends (date-filtered to the selected range) ----
        Map<String, Integer> baseSignups = seedBuckets(bucket);
        Map<String, Integer> premiumSignups = seedBuckets(bucket);
        Map<String, Double> revenueBuckets = new LinkedHashMap<>();
        for (String label : seedBuckets(bucket).keySet()) {
            revenueBuckets.put(label, 0.0);
        }
        Map<String, Integer> monthlyRenewals = seedBuckets(bucket);
        Map<String, Integer> yearlyRenewals = seedBuckets(bucket);

        for (SubscriptionRow s : subscriptions) {
            if (inRange(s.createdAt(), startDate)) {
                incrementBucket(isPremium(s) ? premiumSignups : baseSignups, bucket, s.createdAt());
            }
            if (isPremium(s)) {
                if (inRange(s.startedAt(), startDate)) {
                    addRevenueBucket(revenueBuckets, bucket, s.startedAt(), priceOf(s));
                }
                accumulateRenewals(s, bucket, startDate, monthlyRenewals, yearlyRenewals);
            }
        }

        List<String> signupLabels = orderedLabels(bucket, baseSignups.keySet(), premiumSignups.keySet());
        List<SystemAdminStudentAnalyticsResponse.SignupPoint> signupsOverTime = signupLabels.stream()
                .map(label -> new SystemAdminStudentAnalyticsResponse.SignupPoint(
                        label,
                        baseSignups.getOrDefault(label, 0),
                        premiumSignups.getOrDefault(label, 0)))
                .toList();

        List<String> renewalLabels = orderedLabels(bucket, monthlyRenewals.keySet(), yearlyRenewals.keySet());
        List<SystemAdminStudentAnalyticsResponse.RenewalPoint> renewalsOverTime = renewalLabels.stream()
                .map(label -> new SystemAdminStudentAnalyticsResponse.RenewalPoint(
                        label,
                        monthlyRenewals.getOrDefault(label, 0),
                        yearlyRenewals.getOrDefault(label, 0)))
                .toList();

        List<String> revenueLabels = orderedLabels(bucket, revenueBuckets.keySet());
        List<SystemAdminStudentAnalyticsResponse.RevenuePoint> revenueOverTime = new ArrayList<>();
        double runningRevenue = 0;
        for (String label : revenueLabels) {
            runningRevenue += revenueBuckets.getOrDefault(label, 0.0);
            revenueOverTime.add(new SystemAdminStudentAnalyticsResponse.RevenuePoint(label, round2(runningRevenue)));
        }

        return new SystemAdminStudentAnalyticsResponse(
                new SystemAdminStudentAnalyticsResponse.Summary(
                        subscriptions.size(), baseStudents, premiumStudents, round2(totalRevenue)),
                toStudentChartPoints(tierCounts),
                toStudentChartPoints(cycleCounts),
                toStudentChartPoints(baseStatus),
                toStudentChartPoints(premiumStatus),
                revenueOverTime,
                signupsOverTime,
                renewalsOverTime);
    }

    private List<SubscriptionRow> loadSubscriptions(Integer universityId) {
        String selectEmbed = "student_id,plan_tier,billing_cycle,subscription_price,started_at,expires_at,created_at,student(university_id)";
        String selectPlain = "student_id,plan_tier,billing_cycle,subscription_price,started_at,expires_at,created_at";
        Optional<JsonNode> arr = fetchArray(restRoot() + "/studentsubscription?select=" + selectEmbed + "&limit=5000");
        if (arr.isEmpty()) {
            arr = fetchArray(restRoot() + "/studentsubscription?select=" + selectPlain + "&limit=5000");
        }
        if (arr.isEmpty() || !arr.get().isArray()) {
            return List.of();
        }
        List<SubscriptionRow> rows = new ArrayList<>();
        Set<Integer> studentIdsNeedingUniversity = new LinkedHashSet<>();
        for (JsonNode node : arr.get()) {
            Integer studentId = intVal(node, "student_id");
            Integer embeddedUniversityId = readEmbeddedUniversityId(node.get("student"));
            if (universityId != null && embeddedUniversityId == null && studentId != null) {
                studentIdsNeedingUniversity.add(studentId);
            }
            rows.add(new SubscriptionRow(
                    studentId,
                    embeddedUniversityId,
                    text(node, "plan_tier"),
                    text(node, "billing_cycle"),
                    doubleVal(node, "subscription_price"),
                    text(node, "started_at"),
                    text(node, "expires_at"),
                    text(node, "created_at")));
        }
        if (universityId == null) {
            return rows;
        }
        Map<Integer, Integer> universityByStudentId = studentIdsNeedingUniversity.isEmpty()
                ? Map.of()
                : fetchUniversityByStudentIds(studentIdsNeedingUniversity);
        return rows.stream()
                .filter(row -> {
                    Integer actualUniversityId = row.universityId() != null
                            ? row.universityId()
                            : universityByStudentId.get(row.studentId());
                    return universityId.equals(actualUniversityId);
                })
                .toList();
    }

    private static void accumulateRenewals(
            SubscriptionRow row, String bucket, LocalDate startDate,
            Map<String, Integer> monthlyRenewals, Map<String, Integer> yearlyRenewals) {
        LocalDate started = parseDate(row.startedAt());
        if (started == null) {
            return;
        }
        boolean yearly = "YEARLY".equals(rawCycle(row));
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate expires = parseDate(row.expiresAt());
        LocalDate limit = (expires != null && expires.isBefore(today)) ? expires : today;
        Map<String, Integer> target = yearly ? yearlyRenewals : monthlyRenewals;
        LocalDate cursor = yearly ? started.plusYears(1) : started.plusMonths(1);
        int guard = 0;
        while (!cursor.isAfter(limit) && guard < 600) {
            if (startDate == null || !cursor.isBefore(startDate)) {
                target.merge(labelForDate(cursor.atStartOfDay(), bucket), 1, Integer::sum);
            }
            cursor = yearly ? cursor.plusYears(1) : cursor.plusMonths(1);
            guard++;
        }
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

    private static Map<String, Integer> orderedValues(Map<String, Integer> values, List<String> labels) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String label : labels) {
            out.put(label, values.getOrDefault(label, 0));
        }
        return out;
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

    /**
     * Professional Practice status — two-stage flow: PPA review, then company review.
     * Rejected by either party; pending PPA; approved by PPA (awaiting company); fully approved.
     */
    private static String ppStatus(ApplicationRow row) {
        if (Boolean.FALSE.equals(row.approvedByPpa()) || Boolean.FALSE.equals(row.approvedByCompany())) {
            return "Rejected";
        }
        if (row.approvedByPpa() == null) {
            return "Pending PPA";
        }
        if (Boolean.TRUE.equals(row.approvedByCompany())) {
            return "Fully Approved";
        }
        return "Approved by PPA";
    }

    /** Individual Growth status — company review only, no PPA stage. */
    private static String igStatus(ApplicationRow row) {
        if (Boolean.TRUE.equals(row.approvedByCompany())) {
            return "Approved";
        }
        if (Boolean.FALSE.equals(row.approvedByCompany())) {
            return "Rejected";
        }
        return "Pending";
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
        if ("hourly".equals(granularity)) {
            for (int hour = 0; hour < 24; hour++) {
                out.put(String.format(Locale.ENGLISH, "%02d:00", hour), 0);
            }
        } else if ("daily".equals(granularity)) {
            LocalDate monday = today.with(java.time.DayOfWeek.MONDAY);
            for (int i = 0; i < 7; i++) {
                out.put(monday.plusDays(i).format(DateTimeFormatter.ofPattern("EEE", Locale.ENGLISH)), 0);
            }
        } else if ("weekly".equals(granularity)) {
            LocalDate firstDay = today.withDayOfMonth(1);
            LocalDate cursor = firstDay.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
            LocalDate lastDay = today.withDayOfMonth(today.lengthOfMonth());
            while (!cursor.isAfter(lastDay)) {
                out.put("Week " + cursor.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR), 0);
                cursor = cursor.plusWeeks(1);
            }
        } else if ("monthly".equals(granularity)) {
            for (int i = 1; i <= 12; i++) {
                out.put(LocalDate.of(today.getYear(), i, 1).format(DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH)), 0);
            }
        } else {
            return out;
        }
        return out;
    }

    private static void incrementBucket(Map<String, Integer> buckets, String granularity, String createdAt) {
        LocalDateTime dateTime = parseDateTime(createdAt);
        if (dateTime == null) {
            return;
        }
        String label = labelForDate(dateTime, granularity);
        buckets.merge(label, 1, Integer::sum);
    }

    private static String labelForDate(LocalDateTime dateTime, String granularity) {
        LocalDate date = dateTime.toLocalDate();
        if ("hourly".equals(granularity)) {
            return dateTime.format(DateTimeFormatter.ofPattern("HH:00", Locale.ENGLISH));
        }
        if ("daily".equals(granularity)) {
            return date.format(DateTimeFormatter.ofPattern("EEE", Locale.ENGLISH));
        }
        if ("weekly".equals(granularity)) {
            return "Week " + date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        }
        if ("monthly".equals(granularity)) {
            return date.format(DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH));
        }
        return String.valueOf(date.getYear());
    }

    private static LocalDate parseDate(String value) {
        LocalDateTime dateTime = parseDateTime(value);
        return dateTime == null ? null : dateTime.toLocalDate();
    }

    private static LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value).atZone(ZoneOffset.UTC).toLocalDateTime();
        } catch (Exception ignored) {
            try {
                return LocalDate.parse(value.substring(0, Math.min(10, value.length()))).atStartOfDay();
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    private static String bucketForRange(String range, String granularity) {
        String value = range == null ? "" : range.trim().toLowerCase(Locale.ROOT);
        if ("daily".equals(value)) {
            return "hourly";
        }
        if ("weekly".equals(value)) {
            return "daily";
        }
        if ("monthly".equals(value)) {
            return "weekly";
        }
        if ("yearly".equals(value)) {
            return "monthly";
        }
        if ("total".equals(value)) {
            return "yearly";
        }
        String granularityValue = granularity == null ? "" : granularity.trim().toLowerCase(Locale.ROOT);
        if ("daily".equals(granularityValue) || "monthly".equals(granularityValue)) {
            return granularityValue;
        }
        return "weekly";
    }

    private static LocalDate startDateForRange(String range) {
        String value = range == null ? "" : range.trim().toLowerCase(Locale.ROOT);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if ("daily".equals(value)) {
            return today;
        }
        if ("weekly".equals(value)) {
            return today.with(java.time.DayOfWeek.MONDAY);
        }
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

    private static String sortKeyForBucket(String label, String granularity) {
        if (label == null) {
            return "";
        }
        if ("hourly".equals(granularity)) {
            return String.format(Locale.ENGLISH, "%02d", leadingNumber(label));
        }
        if ("daily".equals(granularity)) {
            return String.format(Locale.ENGLISH, "%02d", dayOrder(label));
        }
        if ("weekly".equals(granularity)) {
            return String.format(Locale.ENGLISH, "%02d", leadingNumber(label));
        }
        if ("monthly".equals(granularity)) {
            return String.format(Locale.ENGLISH, "%02d", monthOrder(label));
        }
        return String.format(Locale.ENGLISH, "%04d", leadingNumber(label));
    }

    private static int leadingNumber(String label) {
        String digits = label.replaceAll("\\D+", " ").trim();
        if (digits.isBlank()) {
            return 0;
        }
        return Integer.parseInt(digits.split("\\s+")[0]);
    }

    private static int dayOrder(String label) {
        List<String> days = List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
        int index = days.indexOf(label);
        return index < 0 ? 99 : index;
    }

    private static int monthOrder(String label) {
        List<String> months = List.of("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
        int index = months.indexOf(label);
        return index < 0 ? 99 : index;
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

    private static String normalizeUpper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String tierOf(SubscriptionRow row) {
        return "PREMIUM".equals(normalizeUpper(row.planTier())) ? "PREMIUM" : "BASE";
    }

    private static boolean isPremium(SubscriptionRow row) {
        return "PREMIUM".equals(tierOf(row));
    }

    /** Normalised billing cycle as stored ("MONTHLY" / "YEARLY" / "NONE" / ""). */
    private static String rawCycle(SubscriptionRow row) {
        return normalizeUpper(row.billingCycle());
    }

    private static double priceOf(SubscriptionRow row) {
        return row.price() == null ? 0.0 : row.price();
    }

    private static Map<String, Integer> seedStatusBuckets() {
        Map<String, Integer> out = new LinkedHashMap<>();
        out.put("Accepted", 0);
        out.put("Rejected", 0);
        out.put("Pending", 0);
        return out;
    }

    /**
     * Three-way application status (type-agnostic — covers Professional Practice
     * and Individual Growth): rejected by either party, else accepted once the
     * company approves, else pending.
     */
    private static String threeWayStatus(ApplicationRow row) {
        if (Boolean.FALSE.equals(row.approvedByCompany()) || Boolean.FALSE.equals(row.approvedByPpa())) {
            return "Rejected";
        }
        if (Boolean.TRUE.equals(row.approvedByCompany())) {
            return "Accepted";
        }
        return "Pending";
    }

    @SafeVarargs
    private static List<String> orderedLabels(String bucket, Set<String>... labelSets) {
        Set<String> all = new LinkedHashSet<>();
        for (Set<String> set : labelSets) {
            all.addAll(set);
        }
        return all.stream()
                .sorted(Comparator.comparing(label -> sortKeyForBucket(label, bucket)))
                .toList();
    }

    private static void addRevenueBucket(Map<String, Double> buckets, String bucket, String dateValue, double amount) {
        LocalDateTime dateTime = parseDateTime(dateValue);
        if (dateTime == null) {
            return;
        }
        buckets.merge(labelForDate(dateTime, bucket), amount, Double::sum);
    }

    private static boolean inRange(String dateValue, LocalDate startDate) {
        if (startDate == null) {
            return true;
        }
        LocalDate date = parseDate(dateValue);
        return date != null && !date.isBefore(startDate);
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static List<SystemAdminStudentAnalyticsResponse.ChartPoint> toStudentChartPoints(Map<String, Integer> values) {
        return values.entrySet().stream()
                .map(e -> new SystemAdminStudentAnalyticsResponse.ChartPoint(e.getKey(), e.getValue()))
                .toList();
    }

    private static Double doubleVal(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        JsonNode v = n.get(field);
        return v.isNumber() ? v.asDouble() : null;
    }

    private record SubscriptionRow(
            Integer studentId,
            Integer universityId,
            String planTier,
            String billingCycle,
            Double price,
            String startedAt,
            String expiresAt,
            String createdAt
    ) {
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
