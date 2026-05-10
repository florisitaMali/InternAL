package com.internaal.dto;

/**
 * Demo payload for {@code POST /api/student/premium/mock-payment}.
 * Replace with real PSP/bank fields when integrating POK or similar.
 */
public class PremiumMockPaymentRequest {

    /** e.g. POK_BANK, CARD, WALLET */
    private String paymentMethod;

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }
}
