package com.internaal.controller;

import com.internaal.service.StripeWebhookService;
import com.stripe.exception.SignatureVerificationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stripe")
public class StripeWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final StripeWebhookService stripeWebhookService;

    public StripeWebhookController(StripeWebhookService stripeWebhookService) {
        this.stripeWebhookService = stripeWebhookService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody byte[] payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String stripeSignature) {
        if (stripeSignature == null || stripeSignature.isBlank()) {
            return ResponseEntity.badRequest().body("Missing Stripe-Signature");
        }
        try {
            stripeWebhookService.handleWebhook(payload, stripeSignature);
            return ResponseEntity.ok("");
        } catch (SignatureVerificationException e) {
            log.warn("Invalid Stripe webhook signature: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        } catch (IllegalStateException e) {
            log.error("Stripe webhook misconfiguration: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        } catch (Exception e) {
            log.error("Stripe webhook processing failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Webhook failed");
        }
    }
}
