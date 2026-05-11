package com.internaal.service;

import com.internaal.dto.AdminCompanyCreateRequest;
import com.internaal.dto.AdminCompanyListResponse;
import com.internaal.dto.AdminCompanyResponse;
import com.internaal.dto.AdminCompanyUpdateRequest;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.repository.SystemAdminCompanyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Year;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class SystemAdminCompanyService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(".+@.+\\..+");
    private static final int NAME_MAX = 200;
    private static final int INDUSTRY_MAX = 200;
    private static final int LOCATION_MAX = 200;
    private static final int WEBSITE_MAX = 500;
    private static final int FOUNDED_MIN = 1800;

    private final SystemAdminCompanyRepository repository;

    public SystemAdminCompanyService(SystemAdminCompanyRepository repository) {
        this.repository = repository;
    }

    public AdminCompanyListResponse listCompanies(UserAccount user) {
        requireSystemAdmin(user);
        List<AdminCompanyResponse> items = repository.listCompaniesWithAccountAndDeps();
        int active = (int) items.stream().filter(AdminCompanyResponse::isActive).count();
        int inactive = items.size() - active;
        return new AdminCompanyListResponse(items, items.size(), active, inactive);
    }

    public AdminCompanyResponse createCompany(UserAccount user, AdminCompanyCreateRequest body) {
        requireSystemAdmin(user);
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        validateName(body.name());
        validateEmail(body.email(), true);
        validateProfileFields(body.industry(), body.location(), body.website(), body.foundedYear(), body.employeeCount());
        if (repository.emailExistsInUserAccount(body.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists.");
        }
        try {
            return repository.createCompany(body);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String userMessage = e.getMessage() == null || e.getMessage().isBlank()
                    ? "Could not create company. Please try again."
                    : e.getMessage();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, userMessage);
        }
    }

    public AdminCompanyResponse updateCompany(UserAccount user, int companyId, AdminCompanyUpdateRequest body) {
        requireSystemAdmin(user);
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        validateName(body.name());
        validateProfileFields(body.industry(), body.location(), body.website(), body.foundedYear(), body.employeeCount());
        try {
            return repository.updateCompany(companyId, body)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String userMessage = e.getMessage() == null || e.getMessage().isBlank()
                    ? "Could not update company. Please try again."
                    : e.getMessage();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, userMessage);
        }
    }

    public AdminCompanyResponse setStatus(UserAccount user, int companyId, Boolean isActive) {
        requireSystemAdmin(user);
        if (isActive == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "isActive is required");
        }
        boolean ok = repository.setCompanyActive(companyId, isActive);
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This company has no account, so its status cannot be changed.");
        }
        return repository.findById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found."));
    }

    /**
     * Hard-delete the company and its account. Refuses with 409 if any dependent
     * opportunity or application row references the company; the AC requires
     * deactivation in that case instead.
     */
    public void deleteCompany(UserAccount user, int companyId) {
        requireSystemAdmin(user);
        if (repository.findById(companyId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found.");
        }
        int[] counts = repository.countDependents(companyId);
        int oppCount = counts[0];
        int appCount = counts[1];
        int fbCount = counts[2];
        if (oppCount + appCount + fbCount > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Company has dependent records (" + oppCount + " opportunities, " + appCount
                            + " applications, " + fbCount + " feedback). Deactivate instead.");
        }
        try {
            repository.deleteCompany(companyId);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            String userMessage = e.getMessage() == null || e.getMessage().isBlank()
                    ? "Could not delete the company. Please try again."
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

    private static void validateProfileFields(String industry, String location, String website,
                                              Integer foundedYear, Integer employeeCount) {
        if (industry != null && industry.length() > INDUSTRY_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "industry must be at most " + INDUSTRY_MAX + " characters");
        }
        if (location != null && location.length() > LOCATION_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "location must be at most " + LOCATION_MAX + " characters");
        }
        if (website != null && website.length() > WEBSITE_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "website must be at most " + WEBSITE_MAX + " characters");
        }
        if (foundedYear != null) {
            int currentYear = Year.now().getValue();
            if (foundedYear < FOUNDED_MIN || foundedYear > currentYear + 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "foundedYear must be between " + FOUNDED_MIN + " and " + (currentYear + 1));
            }
        }
        if (employeeCount != null && employeeCount < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "employeeCount must be >= 0");
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
