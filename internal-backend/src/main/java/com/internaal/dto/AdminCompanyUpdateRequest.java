package com.internaal.dto;

public record AdminCompanyUpdateRequest(
        String name,
        String industry,
        String location,
        String description,
        String website,
        Integer foundedYear,
        Integer employeeCount,
        String specialties,
        String logoUrl,
        String coverUrl
) {
}
