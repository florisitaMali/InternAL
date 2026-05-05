package com.internaal.dto;

public record AdminUniversityUpdateRequest(
        String name,
        String location,
        String website,
        Integer founded,
        String specialties,
        Integer numberOfEmployees
) {
}
