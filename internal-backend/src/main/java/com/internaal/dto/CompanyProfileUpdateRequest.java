package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CompanyProfileUpdateRequest(
        String name,
        String location,
        String description,
        String website,
        String industry,
        Integer employeeCount,
        Integer foundedYear,
        String specialties,
        String logoUrl,
        String coverUrl
) {
}
