package com.internaal.service;

import com.internaal.entity.Opportunity;

import java.util.List;

/**
 * Query parameters for listing opportunities (search, filters).
 */
public record OpportunityQuery(
        String q,
        List<String> skills,
        Opportunity.InternshipType type,
        String location,
        Boolean paid,
        String workMode
) {
}
