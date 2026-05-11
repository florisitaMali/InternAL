package com.internaal.dto;

public record AdminCompanyCreateRequest(
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
        String coverUrl
) {
}
