package com.internaal.dto;

import java.util.List;

public record AdminUniversityListResponse(
        List<AdminUniversityResponse> items,
        int total,
        int active,
        int inactive
) {
}
