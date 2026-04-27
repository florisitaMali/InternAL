package com.internaal.exception;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thrown when request validation fails; carries per-field messages for the API client.
 */
public class ValidationException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public ValidationException(Map<String, String> fieldErrors) {
        super("Validation failed");
        this.fieldErrors = Collections.unmodifiableMap(new LinkedHashMap<>(fieldErrors));
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
