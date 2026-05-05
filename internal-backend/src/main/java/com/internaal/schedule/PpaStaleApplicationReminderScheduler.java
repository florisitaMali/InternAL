package com.internaal.schedule;

import com.internaal.dto.StalePpaReminderRow;
import com.internaal.entity.Role;
import com.internaal.repository.ApplicationRepository;
import com.internaal.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Inserts PPA inbox notifications for PP applications still awaiting approval after 7+ days.
 */
@Component
public class PpaStaleApplicationReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(PpaStaleApplicationReminderScheduler.class);

    private final ApplicationRepository applicationRepository;
    private final NotificationRepository notificationRepository;

    public PpaStaleApplicationReminderScheduler(
            ApplicationRepository applicationRepository,
            NotificationRepository notificationRepository) {
        this.applicationRepository = applicationRepository;
        this.notificationRepository = notificationRepository;
    }

    /** Monday 08:00 (server default zone). */
    @Scheduled(cron = "0 0 8 * * MON")
    public void remindStalePpApplications() {
        List<StalePpaReminderRow> rows = applicationRepository.findProfessionalPracticePendingOlderThanDays(7);
        for (StalePpaReminderRow row : rows) {
            String title = applicationRepository.resolveOpportunityTitleForStaleReminder(row);
            String message = "Reminder: A professional practice application for \"" + title
                    + "\" has been waiting for PP approval for over 7 days (application #" + row.applicationId() + ").";
            boolean ok = notificationRepository.insertNotification(
                    Role.PPA,
                    row.universityId(),
                    message,
                    Role.UNIVERSITY_ADMIN,
                    row.universityId(),
                    row.applicationId());
            if (!ok) {
                log.warn("Stale PP reminder insert failed for application_id={}", row.applicationId());
            }
        }
    }
}
