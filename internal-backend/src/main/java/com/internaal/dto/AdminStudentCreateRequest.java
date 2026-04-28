package com.internaal.dto;

import java.math.BigDecimal;

public record AdminStudentCreateRequest(
        String fullName,
        String email,
        int departmentId,
        int studyFieldId,
        int studyYear,
        BigDecimal cgpa
) {
}
