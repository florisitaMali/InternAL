package com.internaal.entity;

/**
 * One row from {@code opportunitytarget} with embedded {@code university.name}.
 *
 * @param collaborationStatus {@code PENDING}, {@code APPROVED}, or {@code REJECTED}; null/blank treated as APPROVED for legacy rows.
 */
public record TargetUniversity(Integer id, String name, String collaborationStatus) {

    public TargetUniversity(Integer id, String name) {
        this(id, name, null);
    }
}
