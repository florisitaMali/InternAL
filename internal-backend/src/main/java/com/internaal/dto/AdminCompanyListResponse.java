package com.internaal.dto;

import java.util.List;

public record AdminCompanyListResponse(
        List<AdminCompanyResponse> items,
        int total,
        int active,
        int inactive
) {
}
