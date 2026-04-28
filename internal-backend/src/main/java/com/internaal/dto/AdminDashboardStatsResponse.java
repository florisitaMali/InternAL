package com.internaal.dto;

public record AdminDashboardStatsResponse(
        int totalStudents,
        int totalDepartments,
        int totalStudyFields,
        int ppaApprovers
) {
}
