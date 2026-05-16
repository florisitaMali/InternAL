package com.internaal.dto;

import java.util.List;

/**
 * Payload for the System Admin "Student" analytics tab (US-32).
 *
 * <p>Sourced from the {@code studentsubscription} table (one row per student —
 * Base by default, Premium once subscribed), the {@code student} table, and the
 * {@code application} table. No schema changes were needed for this feature.
 */
public record SystemAdminStudentAnalyticsResponse(
        Summary summary,
        List<ChartPoint> tierDistribution,
        List<ChartPoint> billingCycleDistribution,
        List<ChartPoint> baseApplicationStatus,
        List<ChartPoint> premiumApplicationStatus,
        List<RevenuePoint> revenueOverTime,
        List<SignupPoint> signupsOverTime,
        List<RenewalPoint> renewalsOverTime
) {
    public record Summary(
            int totalStudents,
            int baseStudents,
            int premiumStudents,
            double totalRevenue
    ) {
    }

    /** Generic single-series point (counts). */
    public record ChartPoint(String label, int value) {
    }

    /** Cumulative subscription revenue at a point in time. */
    public record RevenuePoint(String label, double amount) {
    }

    /** New student sign-ups in a bucket, split by tier. */
    public record SignupPoint(String label, int base, int premium) {
    }

    /** Subscription renewals in a bucket, split by billing cycle. */
    public record RenewalPoint(String label, int monthly, int yearly) {
    }
}
