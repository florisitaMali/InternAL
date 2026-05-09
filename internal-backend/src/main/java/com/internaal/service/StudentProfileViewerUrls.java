package com.internaal.service;

import com.internaal.dto.StudentProfileFileResponse;
import com.internaal.dto.StudentProfileResponse;

/**
 * Rewrites CV / certification download paths so viewers call role-scoped API routes instead of {@code /api/student/...}.
 */
public final class StudentProfileViewerUrls {

    private StudentProfileViewerUrls() {
    }

    public static void rewriteDownloadUrls(StudentProfileResponse profile, int studentId, String apiSegment) {
        String base = "/api/" + apiSegment + "/students/" + studentId + "/profile";
        if (profile.getCvFile() != null) {
            profile.getCvFile().setDownloadUrl(base + "/cv");
        }
        if (profile.getCertificationFiles() != null) {
            for (StudentProfileFileResponse f : profile.getCertificationFiles()) {
                if (f.getCertificationId() != null) {
                    f.setDownloadUrl(base + "/certifications/" + f.getCertificationId());
                }
            }
        }
    }
}
