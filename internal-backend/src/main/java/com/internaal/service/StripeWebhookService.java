package com.internaal.service;

import com.internaal.repository.StudentProfileRepository;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
public class StripeWebhookService {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookService.class);

    private final StudentProfileRepository studentProfileRepository;

    @Value("${stripe.webhook.secret:}")
    private String webhookSecret;

    public StripeWebhookService(StudentProfileRepository studentProfileRepository) {
        this.studentProfileRepository = studentProfileRepository;
    }

    /**
     * Verifies signature and processes the event. Throws {@link SignatureVerificationException} if invalid.
     */
    public void handleWebhook(byte[] payload, String stripeSignatureHeader) throws Exception {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new IllegalStateException("Stripe webhook secret is not configured.");
        }
        String rawPayload = new String(payload, StandardCharsets.UTF_8);
        Event event = Webhook.constructEvent(rawPayload, stripeSignatureHeader, webhookSecret);

        if (studentProfileRepository.hasStripeWebhookEvent(event.getId())) {
            log.debug("Skipping already-processed Stripe event {}", event.getId());
            return;
        }

        switch (event.getType()) {
            case "checkout.session.completed" -> handleCheckoutSessionCompleted(event);
            case "customer.subscription.created",
                    "customer.subscription.updated" -> handleSubscriptionUpdated(event);
            case "customer.subscription.deleted" -> handleSubscriptionDeleted(event);
            case "invoice.payment_failed" -> handleInvoicePaymentFailed(event);
            default -> log.debug("Ignoring Stripe event type {}", event.getType());
        }

        studentProfileRepository.recordStripeWebhookEvent(event.getId());
    }

    private void handleCheckoutSessionCompleted(Event event) throws Exception {
        Session session = (Session) event.getDataObjectDeserializer().getObject().orElse(null);
        if (session == null) {
            log.warn("checkout.session.completed missing deserialized object for event {}", event.getId());
            return;
        }
        String subscriptionId = session.getSubscription();
        if (subscriptionId == null || subscriptionId.isBlank()) {
            log.warn("checkout.session.completed has no subscription id (event {})", event.getId());
            return;
        }
        Subscription subscription = Subscription.retrieve(subscriptionId);
        applySubscriptionEntitlement(subscription);
    }

    private void handleSubscriptionUpdated(Event event) throws Exception {
        Subscription subscription = (Subscription) event.getDataObjectDeserializer().getObject().orElse(null);
        if (subscription == null) {
            log.warn("subscription event missing object for {}", event.getId());
            return;
        }
        applySubscriptionEntitlement(subscription);
    }

    private void handleSubscriptionDeleted(Event event) throws Exception {
        Subscription subscription = (Subscription) event.getDataObjectDeserializer().getObject().orElse(null);
        if (subscription == null) {
            return;
        }
        Integer studentId = resolveStudentId(subscription);
        if (studentId == null) {
            log.warn("subscription.deleted: could not resolve student_id for sub {}", subscription.getId());
            return;
        }
        studentProfileRepository.patchStudentPremiumStripeState(
                studentId,
                false,
                subscription.getCustomer(),
                null,
                subscription.getStatus(),
                subscription.getCurrentPeriodEnd());
        studentProfileRepository.upsertStudentSubscription(
                studentId,
                false,
                billingCycleOf(subscription),
                amountOf(subscription),
                subscription.getStatus(),
                subscription.getStartDate(),
                subscription.getCurrentPeriodEnd(),
                subscription.getId());
    }

    private void handleInvoicePaymentFailed(Event event) throws Exception {
        Invoice invoice = (Invoice) event.getDataObjectDeserializer().getObject().orElse(null);
        if (invoice == null) {
            return;
        }
        String subscriptionId = invoice.getSubscription();
        if (subscriptionId == null || subscriptionId.isBlank()) {
            return;
        }
        Subscription subscription = Subscription.retrieve(subscriptionId);
        applySubscriptionEntitlement(subscription);
    }

    private void applySubscriptionEntitlement(Subscription subscription) throws Exception {
        Integer studentId = resolveStudentId(subscription);
        if (studentId == null) {
            log.warn("Could not resolve student_id from subscription {}", subscription.getId());
            return;
        }
        boolean entitled = isPremiumEntitled(subscription.getStatus());
        studentProfileRepository.patchStudentPremiumStripeState(
                studentId,
                entitled,
                subscription.getCustomer(),
                subscription.getId(),
                subscription.getStatus(),
                subscription.getCurrentPeriodEnd());
        studentProfileRepository.upsertStudentSubscription(
                studentId,
                entitled,
                billingCycleOf(subscription),
                amountOf(subscription),
                subscription.getStatus(),
                subscription.getStartDate(),
                subscription.getCurrentPeriodEnd(),
                subscription.getId());
    }

    /** Billing cycle from the subscription's first recurring price ("MONTHLY" / "YEARLY"). */
    private static String billingCycleOf(Subscription subscription) {
        try {
            var items = subscription.getItems();
            if (items != null && items.getData() != null && !items.getData().isEmpty()) {
                var price = items.getData().get(0).getPrice();
                if (price != null && price.getRecurring() != null) {
                    String interval = price.getRecurring().getInterval();
                    if ("year".equalsIgnoreCase(interval)) {
                        return "YEARLY";
                    }
                    if ("month".equalsIgnoreCase(interval)) {
                        return "MONTHLY";
                    }
                }
            }
        } catch (Exception ignored) {
            /* fall through to default */
        }
        return "MONTHLY";
    }

    /** Per-period price (major units) from the subscription's first item, or null when unknown. */
    private static Double amountOf(Subscription subscription) {
        try {
            var items = subscription.getItems();
            if (items != null && items.getData() != null && !items.getData().isEmpty()) {
                var price = items.getData().get(0).getPrice();
                if (price != null && price.getUnitAmount() != null) {
                    return price.getUnitAmount() / 100.0;
                }
            }
        } catch (Exception ignored) {
            /* unknown amount */
        }
        return null;
    }

    private static Integer resolveStudentId(Subscription subscription) {
        if (subscription.getMetadata() != null && subscription.getMetadata().containsKey("student_id")) {
            try {
                return Integer.parseInt(subscription.getMetadata().get("student_id"));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    /**
     * Aligns with typical SaaS access: active billing states keep Premium; terminal/unpaid states revoke.
     */
    private static boolean isPremiumEntitled(String status) {
        if (status == null) {
            return false;
        }
        return switch (status) {
            case "active", "trialing", "past_due" -> true;
            default -> false;
        };
    }
}
