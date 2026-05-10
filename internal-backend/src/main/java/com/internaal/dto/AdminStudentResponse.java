package com.internaal.dto;

import java.math.BigDecimal;

public record AdminStudentResponse(
        int studentId,
        String fullName,
        String email,
        String universityName,
        Integer departmentId,
        String departmentName,
        Integer studyFieldId,
        Integer studyYear,
        BigDecimal cgpa,
        String studyFieldName,
        Integer applicationCount,
        String applicationStatus
) {
}
