package com.internaal.dto;

public record AdminDepartmentResponse(
        int departmentId,
        String name,
        String universityName
) {
}
