package com.internaal.service;

import com.internaal.entity.Opportunity;
import com.internaal.entity.TargetUniversity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StudentOpportunityServiceTest {

    private static Opportunity baseOpportunity(List<String> requiredSkills) {
        return new Opportunity(
                1,
                2,
                "Co",
                "T",
                "D",
                requiredSkills,
                "",
                LocalDate.now(),
                List.<TargetUniversity>of(),
                null,
                null,
                null,
                Opportunity.WorkMode.Remote,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                null);
    }

    @Test
    void skillMatchCount_isCaseInsensitiveOverlap() {
        Opportunity o = baseOpportunity(List.of("React", "TypeScript", "SQL"));
        List<String> studentSkills = List.of("react", "SQL");
        assertThat(StudentOpportunityService.skillMatchCount(o, studentSkills)).isEqualTo(2);
    }

    @Test
    void skillMatchCount_emptyStudentSkills_returnsZero() {
        Opportunity o = baseOpportunity(List.of("React"));
        assertThat(StudentOpportunityService.skillMatchCount(o, List.of())).isEqualTo(0);
    }
}
