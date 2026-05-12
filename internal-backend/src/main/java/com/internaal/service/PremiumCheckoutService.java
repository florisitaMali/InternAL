package com.internaal.service;

import com.internaal.dto.PremiumCheckoutSessionRequest;
import com.internaal.dto.PremiumBillingPortalRequest;
import com.internaal.repository.StudentProfileRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class PremiumCheckoutService {

    private static final Logger log = LoggerFactory.getLogger(PremiumCheckoutService.class);

    private final StudentProfileRepository studentProfileRepository;

    @Value("${stripe.secret.key:}")
    private String stripeSecretKey;

    @Value("${stripe.price.premium.monthly:}")
    private String defaultPriceId;

    @Value("${app.frontend.url:}")
    private String frontendUrl;

    public PremiumCheckoutService(StudentProfileRepository studentProfileRepository) {
        this.studentProfileRepository = studentProfileRepository;
    }

    public String createCheckoutSession(Integer studentId, PremiumCheckoutSessionRequest request)
            throws StripeException {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            throw new IllegalStateException("Stripe is not configured (missing STRIPE_SECRET_KEY).");
        }
        String priceId = request != null && request.getPriceId() != null && !request.getPriceId().isBlank()
                ? request.getPriceId().trim()
                : defaultPriceId;
        if (priceId == null || priceId.isBlank()) {
            throw new IllegalStateException("Stripe price id is not configured (set STRIPE_PRICE_PREMIUM_MONTHLY).");
        }

        String base = effectiveFrontendBase();
        String success =
                pickRedirect(request != null ? request.getSuccessUrl() : null, base + "/premium/success");
        String cancel = pickRedirect(request != null ? request.getCancelUrl() : null, base + "/premium");

        assertAllowedRedirect(success, base);
        assertAllowedRedirect(cancel, base);

        Stripe.apiKey = stripeSecretKey;

        SessionCreateParams.Builder params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setSuccessUrl(success)
                .setCancelUrl(cancel)
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setPrice(priceId)
                                .setQuantity(1L)
                                .build())
                .setClientReferenceId(String.valueOf(studentId))
                .putMetadata("student_id", String.valueOf(studentId))
                .setSubscriptionData(
                        SessionCreateParams.SubscriptionData.builder()
                                .putMetadata("student_id", String.valueOf(studentId))
                                .build());

        Optional<String> existingCustomer = studentProfileRepository.findStripeCustomerIdByStudentId(studentId);
        existingCustomer.ifPresent(params::setCustomer);

        Session session = Session.create(params.build());
        log.info("Created Stripe Checkout Session {} for student_id={}", session.getId(), studentId);
        return session.getUrl();
    }

    /**
     * Opens Stripe Customer Portal for subscription management (cancel, payment method, invoices).
     * Requires {@link com.internaal.repository.StudentProfileRepository#findStripeCustomerIdByStudentId} after checkout.
     */
    public String createBillingPortalSession(Integer studentId, PremiumBillingPortalRequest request)
            throws StripeException {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            throw new IllegalStateException("Stripe is not configured (missing STRIPE_SECRET_KEY).");
        }
        Optional<String> customerId = studentProfileRepository.findStripeCustomerIdByStudentId(studentId);
        if (customerId.isEmpty() || customerId.get().isBlank()) {
            throw new IllegalStateException(
                    "No billing account yet. Subscribe via Premium checkout first, then you can manage your subscription.");
        }

        String base = effectiveFrontendBase();
        String returnUrl =
                pickRedirect(request != null ? request.getReturnUrl() : null, base + "/premium/");
        assertAllowedRedirect(returnUrl, base);

        Stripe.apiKey = stripeSecretKey;

        com.stripe.model.billingportal.Session session =
                com.stripe.model.billingportal.Session.create(
                        com.stripe.param.billingportal.SessionCreateParams.builder()
                                .setCustomer(customerId.get())
                                .setReturnUrl(returnUrl)
                                .build());
        log.info("Created Stripe Billing Portal session {} for student_id={}", session.getId(), studentId);
        return session.getUrl();
    }

    private static String normalizeBaseUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String t = raw.trim();
        return t.endsWith("/") ? t.substring(0, t.length() - 1) : t;
    }

    private String effectiveFrontendBase() {
        String base = normalizeBaseUrl(frontendUrl);
        return base.isBlank() ? "http://localhost:3000" : base;
    }

    private static String pickRedirect(String candidate, String fallback) {
        if (candidate != null && !candidate.isBlank()) {
            return candidate.trim();
        }
        return fallback;
    }

    /** Prevents open redirects: URLs must start with the effective frontend base ({@code FRONTEND_URL} or localhost default). */
    private static void assertAllowedRedirect(String url, String base) {
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("Checkout redirect URL could not be resolved; set FRONTEND_URL.");
        }
        if (!url.startsWith(base)) {
            throw new IllegalArgumentException("Redirect URL must start with the configured FRONTEND_URL (or localhost default).");
        }
    }
}
