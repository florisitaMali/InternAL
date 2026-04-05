package com.internaal.dto;

public class StudentFileDownload {

    private final byte[] bytes;
    private final String filename;
    private final String mimeType;

    public StudentFileDownload(byte[] bytes, String filename, String mimeType) {
        this.bytes = bytes;
        this.filename = filename;
        this.mimeType = mimeType;
    }

    public byte[] getBytes() {
        return bytes;
    }

    public String getFilename() {
        return filename;
    }

    public String getMimeType() {
        return mimeType;
    }
}
