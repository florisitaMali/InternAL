package com.internaal.service;

import com.internaal.entity.Opportunity;

import java.util.List;

/**
 * Query parameters for listing opportunities (search, filters).
 */
public record OpportunityQuery(
        String q,
        List<String> skills,
        /** Filter: opportunities whose {@code type} equals this value (case-insensitive). */
        String type,
        String location,
        Boolean paid,
        String workMode
) {
}
