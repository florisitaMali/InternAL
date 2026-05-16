package com.internaal.service;

import com.internaal.dto.SystemAdminAnalyticsResponse;
import com.internaal.dto.SystemAdminStudentAnalyticsResponse;
import com.internaal.entity.UserAccount;
import com.internaal.repository.SystemAdminAnalyticsRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SystemAdminAnalyticsService {

    private final SystemAdminAnalyticsRepository repository;

    public SystemAdminAnalyticsService(SystemAdminAnalyticsRepository repository) {
        this.repository = repository;
    }

    public SystemAdminAnalyticsResponse analytics(
            UserAccount user,
            Integer universityId,
            Integer companyId,
            String granularity,
            String range) {
        requireSystemAdmin(user);
        return repository.analytics(universityId, companyId, granularity, range);
    }

    public SystemAdminStudentAnalyticsResponse studentAnalytics(
            UserAccount user,
            Integer universityId,
            String subscriptionTier,
            String billingCycle,
            String granularity,
            String range) {
        requireSystemAdmin(user);
        return repository.studentAnalytics(universityId, subscriptionTier, billingCycle, granularity, range);
    }

    private static void requireSystemAdmin(UserAccount user) {
        if (user == null || user.getRole() == null || !"SYSTEM_ADMIN".equals(user.getRole().name())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only system admins can view platform analytics.");
        }
    }
}
