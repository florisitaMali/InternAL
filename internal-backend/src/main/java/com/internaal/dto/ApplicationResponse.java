package com.internaal.dto;

public class ApplicationResponse {

    private Integer applicationId;
    private Integer studentId;
    private Integer companyId;
    private Integer opportunityId;
    private String applicationType;
    private String phoneNumber;
    private Boolean accuracyConfirmed;
    private String createdAt;
    private String status;
    private Boolean isApprovedByPPA;
    private Boolean isApprovedByCompany;
    private String opportunityTitle;
    private String companyName;
    /** Present when application is loaded with a {@code student} embed (company / admin / PPA views). */
    private String studentName;

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

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public Boolean getAccuracyConfirmed() { return accuracyConfirmed; }
    public void setAccuracyConfirmed(Boolean accuracyConfirmed) { this.accuracyConfirmed = accuracyConfirmed; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Boolean getIsApprovedByPPA() { return isApprovedByPPA; }
    public void setIsApprovedByPPA(Boolean isApprovedByPPA) { this.isApprovedByPPA = isApprovedByPPA; }

    public Boolean getIsApprovedByCompany() { return isApprovedByCompany; }
    public void setIsApprovedByCompany(Boolean isApprovedByCompany) { this.isApprovedByCompany = isApprovedByCompany; }

    public String getOpportunityTitle() { return opportunityTitle; }
    public void setOpportunityTitle(String opportunityTitle) { this.opportunityTitle = opportunityTitle; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
}