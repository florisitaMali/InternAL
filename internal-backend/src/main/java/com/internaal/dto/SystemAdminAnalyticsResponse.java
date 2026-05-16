package com.internaal.dto;

import java.util.List;

public record SystemAdminAnalyticsResponse(
        Summary summary,
        List<ChartPoint> applicationStatusDistribution,
        List<ChartPoint> applicationsOverTime,
        List<OpportunityApplicationPoint> opportunitiesVsApplications,
        List<ChartPoint> applicationTypeDistribution,
        ApprovalRate approvalRate
) {
    public record Summary(
            int totalUniversities,
            int totalCompanies,
            int totalOpportunities,
            int totalApplications
    ) {
    }

    public record ChartPoint(String label, int value) {
    }

    public record OpportunityApplicationPoint(String label, int opportunities, int applications) {
    }

    public record ApprovalRate(
            int approved,
            int rejected,
            int total,
            int approvalPercentage,
            int rejectionPercentage
    ) {
    }
}
