package com.internaal.dto;

public class StudentProfileUpdateRequest {

    private String description;
    private String skills;
    private String certificates;
    private String languages;
    private String experience;
    private String hobbies;
    private String bannerTitle;
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSkills() { return skills; }
    public void setSkills(String skills) { this.skills = skills; }
    public String getCertificates() { return certificates; }
    public void setCertificates(String certificates) { this.certificates = certificates; }
    public String getLanguages() { return languages; }
    public void setLanguages(String languages) { this.languages = languages; }
    public String getExperience() { return experience; }
    public void setExperience(String experience) { this.experience = experience; }
    public String getHobbies() { return hobbies; }
    public void setHobbies(String hobbies) { this.hobbies = hobbies; }
    public String getBannerTitle() { return bannerTitle; }
    public void setBannerTitle(String bannerTitle) { this.bannerTitle = bannerTitle; }
}
