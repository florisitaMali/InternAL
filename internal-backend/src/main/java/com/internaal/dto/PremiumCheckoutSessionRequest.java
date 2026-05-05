package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Optional overrides for Stripe Checkout redirect URLs and price id.
 */
public class PremiumCheckoutSessionRequest {

    @JsonProperty("successUrl")
    private String successUrl;

    @JsonProperty("cancelUrl")
    private String cancelUrl;

    /** Override default {@code STRIPE_PRICE_PREMIUM_MONTHLY} when provided. */
    @JsonProperty("priceId")
    private String priceId;

    public String getSuccessUrl() {
        return successUrl;
    }

    public void setSuccessUrl(String successUrl) {
        this.successUrl = successUrl;
    }

    public String getCancelUrl() {
        return cancelUrl;
    }

    public void setCancelUrl(String cancelUrl) {
        this.cancelUrl = cancelUrl;
    }

    public String getPriceId() {
        return priceId;
    }

    public void setPriceId(String priceId) {
        this.priceId = priceId;
    }
}
