package com.internaal.service;

import com.internaal.entity.Opportunity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StudentOpportunityServiceTest {

    @Test
    void skillMatchCount_isCaseInsensitiveOverlap() {
        Opportunity o = new Opportunity(
                1,
                2,
                "Co",
                "T",
                "D",
                List.of("React", "TypeScript", "SQL"),
                "",
                LocalDate.now(),
                null,
                List.of(),
                null,
                null,
                null,
                Opportunity.WorkMode.Remote,
                1,
                null,
                null,
                null,
                null,
                false,
                null
        );
        List<String> studentSkills = List.of("react", "SQL");
        assertThat(StudentOpportunityService.skillMatchCount(o, studentSkills)).isEqualTo(2);
    }

   
}
