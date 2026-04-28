package com.internaal.dto;

public class CurrentUserResponse {

    private Integer userId;
    private String email;
    private String role;
    private Integer linkedEntityId;

    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Integer getLinkedEntityId() { return linkedEntityId; }
    public void setLinkedEntityId(Integer linkedEntityId) { this.linkedEntityId = linkedEntityId; }
}
