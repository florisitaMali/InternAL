package com.internaal.dto;

public record AdminUniversityCreateRequest(
        String name,
        String email,
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
