package com.internaal.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class StudentProfileResponse {

    private Integer studentId;
    private String fullName;
    private String email;
    private String phone;
    private Integer universityId;
    private String universityName;
    private Integer departmentId;
    private String departmentName;
    private Integer fieldId;
    private String fieldName;
    private Integer studyYear;
    private BigDecimal cgpa;
    private Boolean hasCompletedPp;
    private String accessStartDate;
    private String accessEndDate;
    private String description;
    private String skills;
    private String certificates;
    private String languages;
    private String experience;
    private String hobbies;
    private String cvUrl;
    private String cvFilename;
    private String photo;
    private String coverUrl;
    private String bannerTitle;
    private StudentProfileFileResponse cvFile;
    private List<StudentProfileFileResponse> certificationFiles = new ArrayList<>();
    private List<StudentProjectResponse> projects = new ArrayList<>();
    private List<StudentExperienceResponse> experiences = new ArrayList<>();

    public Integer getStudentId() { return studentId; }
    public void setStudentId(Integer studentId) { this.studentId = studentId; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Integer getUniversityId() { return universityId; }
    public void setUniversityId(Integer universityId) { this.universityId = universityId; }
    public String getUniversityName() { return universityName; }
    public void setUniversityName(String universityName) { this.universityName = universityName; }
    public Integer getDepartmentId() { return departmentId; }
    public void setDepartmentId(Integer departmentId) { this.departmentId = departmentId; }
    public String getDepartmentName() { return departmentName; }
    public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }
    public Integer getFieldId() { return fieldId; }
    public void setFieldId(Integer fieldId) { this.fieldId = fieldId; }
    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }
    public Integer getStudyYear() { return studyYear; }
    public void setStudyYear(Integer studyYear) { this.studyYear = studyYear; }
    public BigDecimal getCgpa() { return cgpa; }
    public void setCgpa(BigDecimal cgpa) { this.cgpa = cgpa; }
    public Boolean getHasCompletedPp() { return hasCompletedPp; }
    public void setHasCompletedPp(Boolean hasCompletedPp) { this.hasCompletedPp = hasCompletedPp; }
    public String getAccessStartDate() { return accessStartDate; }
    public void setAccessStartDate(String accessStartDate) { this.accessStartDate = accessStartDate; }
    public String getAccessEndDate() { return accessEndDate; }
    public void setAccessEndDate(String accessEndDate) { this.accessEndDate = accessEndDate; }
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
    public String getCvUrl() { return cvUrl; }
    public void setCvUrl(String cvUrl) { this.cvUrl = cvUrl; }
    public String getCvFilename() { return cvFilename; }
    public void setCvFilename(String cvFilename) { this.cvFilename = cvFilename; }
    public String getPhoto() { return photo; }
    public void setPhoto(String photo) { this.photo = photo; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }
    public String getBannerTitle() { return bannerTitle; }
    public void setBannerTitle(String bannerTitle) { this.bannerTitle = bannerTitle; }
    public StudentProfileFileResponse getCvFile() { return cvFile; }
    public void setCvFile(StudentProfileFileResponse cvFile) { this.cvFile = cvFile; }
    public List<StudentProfileFileResponse> getCertificationFiles() { return certificationFiles; }
    public void setCertificationFiles(List<StudentProfileFileResponse> certificationFiles) {
        this.certificationFiles = certificationFiles == null ? new ArrayList<>() : certificationFiles;
    }
    public List<StudentProjectResponse> getProjects() { return projects; }
    public void setProjects(List<StudentProjectResponse> projects) {
        this.projects = projects == null ? new ArrayList<>() : projects;
    }
    public List<StudentExperienceResponse> getExperiences() { return experiences; }
    public void setExperiences(List<StudentExperienceResponse> experiences) {
        this.experiences = experiences == null ? new ArrayList<>() : experiences;
    }
}
