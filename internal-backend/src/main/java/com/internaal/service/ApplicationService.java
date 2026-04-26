package com.internaal.service;

import com.internaal.dto.ApplicationRequest;
import com.internaal.dto.ApplicationResponse;
import com.internaal.repository.ApplicationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;

    public ApplicationService(ApplicationRepository applicationRepository) {
        this.applicationRepository = applicationRepository;
    }

    public ApplicationResponse submitApplication(Integer studentId, ApplicationRequest request) {
        return applicationRepository.save(studentId, request)
                .orElseThrow(() -> new RuntimeException("Failed to submit application"));
    }

    public List<ApplicationResponse> getApplicationsByStudent(Integer studentId) {
        return applicationRepository.findByStudentId(studentId);
    }
}