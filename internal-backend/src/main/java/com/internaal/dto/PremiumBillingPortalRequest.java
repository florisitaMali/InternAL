package com.internaal.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Optional return URL after Stripe Customer Portal (must match configured FRONTEND_URL). */
public class PremiumBillingPortalRequest {

    @JsonProperty("returnUrl")
    private String returnUrl;

    public String getReturnUrl() {
        return returnUrl;
    }

    public void setReturnUrl(String returnUrl) {
        this.returnUrl = returnUrl;
    }
}
