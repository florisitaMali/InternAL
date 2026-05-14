package com.internaal.dto;

import java.util.List;

public record PpaCsvImportResult(
        int created,
        int updated,
        int failed,
        List<String> errors
) {
}
