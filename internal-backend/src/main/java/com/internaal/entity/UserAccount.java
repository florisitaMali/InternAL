package com.internaal.entity;

public class UserAccount {

    private Integer userId;
    private String email;
    private String password;
    private Role role;
    private Integer linkedEntityId;

    public UserAccount() {}

    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public Integer getLinkedEntityId() { return linkedEntityId; }
    public void setLinkedEntityId(Integer linkedEntityId) { this.linkedEntityId = linkedEntityId; }
}
