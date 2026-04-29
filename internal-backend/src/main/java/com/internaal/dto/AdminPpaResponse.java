package com.internaal.dto;

import java.util.List;

public record AdminPpaResponse(
        int ppaId,
        String fullName,
        String email,
        Integer departmentId,
        String departmentName,
        List<AdminStudyFieldResponse> studyFields
) {
}
