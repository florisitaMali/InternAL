package com.internaal.dto;

public record AdminUniversityUpdateRequest(
        String name,
        String location,
        String description,
        String website,
        Integer founded,
        String specialties,
        Integer numberOfEmployees,
        String logoUrl,
        String coverUrl
) {
}
