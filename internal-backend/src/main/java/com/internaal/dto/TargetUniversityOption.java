package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TargetUniversityOption(int universityId, String name, String collaborationStatus) {
    public TargetUniversityOption(int universityId, String name) {
        this(universityId, name, null);
    }
}
