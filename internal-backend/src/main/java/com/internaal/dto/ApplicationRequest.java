package com.internaal.dto;

public class ApplicationRequest {

    private Integer opportunityId;
    private String applicationType;
    private String phoneNumber;
    private Boolean accuracyConfirmed;

    public Integer getOpportunityId() { return opportunityId; }
    public void setOpportunityId(Integer opportunityId) { this.opportunityId = opportunityId; }

    public String getApplicationType() { return applicationType; }
    public void setApplicationType(String applicationType) { this.applicationType = applicationType; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public Boolean getAccuracyConfirmed() { return accuracyConfirmed; }
    public void setAccuracyConfirmed(Boolean accuracyConfirmed) { this.accuracyConfirmed = accuracyConfirmed; }
}