package com.internaal.dto;

public record AdminUniversityCreateRequest(
        String name,
        String email,
        String location,
        String website,
        Integer founded,
        String specialties,
        Integer numberOfEmployees
) {
}
