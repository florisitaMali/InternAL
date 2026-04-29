package com.internaal.dto;

import java.util.List;

public record AdminPpaCreateRequest(
        String fullName,
        String email,
        Integer departmentId,
        List<Integer> studyFieldIds
) {
}
