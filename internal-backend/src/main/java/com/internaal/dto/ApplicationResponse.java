package com.internaal.dto;

public class ApplicationResponse {

    private Integer applicationId;
    private Integer studentId;
    private Integer companyId;
    private Integer opportunityId;
    private String applicationType;
    private Boolean accuracyConfirmed;
    private String createdAt;

    public Integer getApplicationId() { return applicationId; }
    public void setApplicationId(Integer applicationId) { this.applicationId = applicationId; }

    public Integer getStudentId() { return studentId; }
    public void setStudentId(Integer studentId) { this.studentId = studentId; }

    public Integer getCompanyId() { return companyId; }
    public void setCompanyId(Integer companyId) { this.companyId = companyId; }

    public Integer getOpportunityId() { return opportunityId; }
    public void setOpportunityId(Integer opportunityId) { this.opportunityId = opportunityId; }

    public String getApplicationType() { return applicationType; }
    public void setApplicationType(String applicationType) { this.applicationType = applicationType; }

    public Boolean getAccuracyConfirmed() { return accuracyConfirmed; }
    public void setAccuracyConfirmed(Boolean accuracyConfirmed) { this.accuracyConfirmed = accuracyConfirmed; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}