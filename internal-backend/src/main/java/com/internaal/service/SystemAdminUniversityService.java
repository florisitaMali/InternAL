package com.internaal.service;

import com.internaal.dto.AdminUniversityCreateRequest;
import com.internaal.dto.AdminUniversityListResponse;
import com.internaal.dto.AdminUniversityResponse;
import com.internaal.dto.AdminUniversityUpdateRequest;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.repository.SystemAdminUniversityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Year;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class SystemAdminUniversityService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(".+@.+\\..+");
    private static final int NAME_MAX = 200;
    private static final int LOCATION_MAX = 200;
    private static final int WEBSITE_MAX = 500;
    private static final int FOUNDED_MIN = 1800;

    private final SystemAdminUniversityRepository repository;

    public SystemAdminUniversityService(SystemAdminUniversityRepository repository) {
        this.repository = repository;
    }

    public AdminUniversityListResponse listUniversities(UserAccount user) {
        requireSystemAdmin(user);
        List<AdminUniversityResponse> items = repository.listUniversitiesWithAdminActiveFlag();
        int active = (int) items.stream().filter(AdminUniversityResponse::isActive).count();
        int inactive = items.size() - active;
        return new AdminUniversityListResponse(items, items.size(), active, inactive);
    }

    public AdminUniversityResponse createUniversity(UserAccount user, AdminUniversityCreateRequest body) {
        requireSystemAdmin(user);
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        validateName(body.name());
        validateEmail(body.email(), true);
        validateProfileFields(body.location(), body.website(), body.founded(), body.numberOfEmployees());
        if (repository.emailExistsInUserAccount(body.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists.");
        }
        try {
            return repository.createUniversity(body);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String userMessage = e.getMessage() == null || e.getMessage().isBlank()
                    ? "Could not create university. Please try again."
                    : e.getMessage();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, userMessage);
        }
    }

    public AdminUniversityResponse updateUniversity(UserAccount user, int universityId, AdminUniversityUpdateRequest body) {
        requireSystemAdmin(user);
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        validateName(body.name());
        validateProfileFields(body.location(), body.website(), body.founded(), body.numberOfEmployees());
        try {
            return repository.updateUniversity(universityId, body)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "University not found."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String userMessage = e.getMessage() == null || e.getMessage().isBlank()
                    ? "Could not update university. Please try again."
                    : e.getMessage();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, userMessage);
        }
    }

    public AdminUniversityResponse setStatus(UserAccount user, int universityId, Boolean isActive) {
        requireSystemAdmin(user);
        if (isActive == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "isActive is required");
        }
        boolean ok = repository.setUniversityActive(universityId, isActive);
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This university has no admin account, so its status cannot be changed.");
        }
        return repository.findById(universityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "University not found."));
    }

    /**
     * Hard-delete the university and its admin account. Refuses with 409 if any department
     * or student references the university; the AC requires deactivation in that case.
     */
    public void deleteUniversity(UserAccount user, int universityId) {
        requireSystemAdmin(user);
        if (repository.findById(universityId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "University not found.");
        }
        int[] counts = repository.countDependents(universityId);
        int deptCount = counts[0];
        int studentCount = counts[1];
        // OR: any single dependency type blocks hard-delete.
        if (deptCount > 0 || studentCount > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "University has dependent records (" + deptCount + " departments, "
                            + studentCount + " students). Deactivate instead.");
        }
        try {
            repository.deleteUniversity(universityId);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String userMessage = e.getMessage() == null || e.getMessage().isBlank()
                    ? "Could not delete the university. Please try again."
                    : e.getMessage();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, userMessage);
        }
    }

    /* ---------- VALIDATION ---------- */

    private static void validateName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");
        }
        if (name.trim().length() > NAME_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name must be at most " + NAME_MAX + " characters");
        }
    }

    private static void validateEmail(String email, boolean required) {
        if (email == null || email.trim().isEmpty()) {
            if (required) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "email is required");
            }
            return;
        }
        if (!EMAIL_PATTERN.matcher(email.trim()).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "email format is invalid");
        }
    }

    private static void validateProfileFields(String location, String website, Integer founded, Integer numberOfEmployees) {
        if (location != null && location.length() > LOCATION_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "location must be at most " + LOCATION_MAX + " characters");
        }
        if (website != null && website.length() > WEBSITE_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "website must be at most " + WEBSITE_MAX + " characters");
        }
        if (founded != null) {
            int currentYear = Year.now().getValue();
            if (founded < FOUNDED_MIN || founded > currentYear + 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "founded must be between " + FOUNDED_MIN + " and " + (currentYear + 1));
            }
        }
        if (numberOfEmployees != null && numberOfEmployees < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "numberOfEmployees must be >= 0");
        }
    }

    private static void requireSystemAdmin(UserAccount user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (user.getRole() != Role.SYSTEM_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "System admin role required");
        }
    }
}
