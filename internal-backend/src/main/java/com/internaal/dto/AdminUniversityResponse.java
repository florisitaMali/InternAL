package com.internaal.dto;

public record AdminUniversityResponse(
        int universityId,
        String name,
        String email,
        String location,
        String website,
        Integer founded,
        String specialties,
        Integer numberOfEmployees,
        boolean isActive
) {
}
