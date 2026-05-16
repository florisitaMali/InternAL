package com.internaal.dto;

import java.math.BigDecimal;

public record AdminStudentResponse(
        int studentId,
        String fullName,
        String email,
        String universityName,
        Integer departmentId,
        Integer studyFieldId,
        Integer studyYear,
        BigDecimal cgpa,
        String studyFieldName,
        String departmentName,
        Integer applicationCount,
        String applicationStatus
) {
}
