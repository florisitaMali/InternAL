package com.internaal.dto;

public record AdminCompanyResponse(
        int companyId,
        String name,
        String email,
        String industry,
        String location,
        String description,
        String website,
        Integer foundedYear,
        Integer employeeCount,
        String specialties,
        String logoUrl,
        String coverUrl,
        boolean isActive,
        boolean canDelete,
        int opportunityCount,
        int applicationCount,
        int feedbackCount
) {
}
