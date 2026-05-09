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
 * Inserts PPA inbox notifications for professional-practice applications still awaiting PP approval
 * after 14+ days, at most once per 7 days per application.
 */
@Component
public class PpaStaleApplicationReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(PpaStaleApplicationReminderScheduler.class);

    /** Applications submitted before this age (and still without PPA decision) qualify for a reminder. */
    private static final int STALE_AFTER_DAYS = 14;
    /** Skip insert if we already notified this PPA inbox about the same application within this window. */
    private static final int REMINDER_COOLDOWN_DAYS = 7;

    private final ApplicationRepository applicationRepository;
    private final NotificationRepository notificationRepository;

    public PpaStaleApplicationReminderScheduler(
            ApplicationRepository applicationRepository,
            NotificationRepository notificationRepository) {
        this.applicationRepository = applicationRepository;
        this.notificationRepository = notificationRepository;
    }

    /** Daily 08:00 (server default zone). */
    @Scheduled(cron = "0 0 8 * * ?")
    public void remindStalePpApplications() {
        List<StalePpaReminderRow> rows = applicationRepository.findProfessionalPracticePendingOlderThanDays(STALE_AFTER_DAYS);
        for (StalePpaReminderRow row : rows) {
            if (notificationRepository.hasNotificationForApplicationSince(
                    row.applicationId(),
                    row.universityId(),
                    Role.PPA,
                    REMINDER_COOLDOWN_DAYS)) {
                continue;
            }
            String title = applicationRepository.resolveOpportunityTitleForStaleReminder(row);
            String message = "There are applications waiting for your decision. A professional practice request for \""
                    + title + "\" was submitted over two weeks ago and still needs your review.";
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
