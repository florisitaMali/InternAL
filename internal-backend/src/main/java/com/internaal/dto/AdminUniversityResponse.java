package com.internaal.dto;

public record AdminUniversityResponse(
        int universityId,
        String name,
        String email,
        String location,
        String description,
        String website,
        Integer founded,
        String specialties,
        Integer numberOfEmployees,
        String logoUrl,
        String coverUrl,
        boolean isActive,
        boolean canDelete,
        int departmentCount,
        int studentCount
) {
}
