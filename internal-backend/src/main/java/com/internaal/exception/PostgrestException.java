package com.internaal.exception;

public class PostgrestException extends RuntimeException {

    private final int statusCode;

    public PostgrestException(int statusCode, String message) {
        super(message != null && !message.isBlank() ? message : "PostgREST request failed");
        this.statusCode = statusCode;
    }

    public int getStatusCode() {
        return statusCode;
    }
}
