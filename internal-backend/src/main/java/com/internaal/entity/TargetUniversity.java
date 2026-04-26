package com.internaal.entity;

/**
 * One row from {@code opportunitytarget} with embedded {@code university.name}.
 */
public record TargetUniversity(Integer id, String name) {
}
