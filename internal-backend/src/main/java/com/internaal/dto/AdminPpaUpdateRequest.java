package com.internaal.dto;

import java.util.List;

public record AdminPpaUpdateRequest(
        String fullName,
        String email,
        Integer departmentId,
        List<Integer> studyFieldIds
) {
}
