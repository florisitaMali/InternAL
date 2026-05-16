package com.internaal.service;

import com.internaal.dto.AdminCompanySummaryResponse;
import com.internaal.dto.InstitutionalPartnershipCompaniesResponse;
import com.internaal.dto.InstitutionalPartnershipCompanyItem;
import com.internaal.dto.InstitutionalPartnershipUniversitiesResponse;
import com.internaal.dto.InstitutionalPartnershipUniversityItem;
import com.internaal.dto.TargetUniversityOption;
import com.internaal.entity.Role;
import com.internaal.entity.UserAccount;
import com.internaal.repository.CompanyUniversityPartnershipRepository;
import com.internaal.repository.CompanyUniversityPartnershipRepository.PartnershipRow;
import com.internaal.repository.NotificationRepository;
import com.internaal.repository.OpportunityRepository;
import com.internaal.repository.UniversityAdminRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class InstitutionalPartnershipService {

    private static final String R_COMPANY = "COMPANY";
    private static final String R_UNI = "UNIVERSITY_ADMIN";

    private final CompanyUniversityPartnershipRepository partnershipRepository;
    private final OpportunityRepository opportunityRepository;
    private final UniversityAdminRepository universityAdminRepository;
    private final NotificationRepository notificationRepository;

    public InstitutionalPartnershipService(
            CompanyUniversityPartnershipRepository partnershipRepository,
            OpportunityRepository opportunityRepository,
            UniversityAdminRepository universityAdminRepository,
            NotificationRepository notificationRepository) {
        this.partnershipRepository = partnershipRepository;
        this.opportunityRepository = opportunityRepository;
        this.universityAdminRepository = universityAdminRepository;
        this.notificationRepository = notificationRepository;
    }

    public InstitutionalPartnershipUniversitiesResponse listUniversitiesForCompany(UserAccount user) {
        requireRole(user, Role.COMPANY);
        int companyId = parseCompanyId(user);
        Map<Integer, PartnershipRow> byUni = partnershipRepository.mapByUniversityForCompany(companyId);
        List<TargetUniversityOption> all = opportunityRepository.findUniversitiesFromUniversityTable();
        List<InstitutionalPartnershipUniversityItem> out = new ArrayList<>();
        for (TargetUniversityOption u : all) {
            PartnershipRow p = byUni.get(u.universityId());
            out.add(buildUniversityItemForCompanyView(companyId, u.universityId(), u.name(), p));
        }
        return new InstitutionalPartnershipUniversitiesResponse(out);
    }

    public void requestPartnershipAsCompany(UserAccount user, int universityId) {
        requireRole(user, Role.COMPANY);
        int companyId = parseCompanyId(user);
        if (universityId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid university");
        }
        Optional<PartnershipRow> existing = partnershipRepository.findByPair(companyId, universityId);
        if (existing.isEmpty()) {
            partnershipRepository.insertPending(companyId, universityId, R_COMPANY, companyId);
            notifyPartnershipRequest(Role.UNIVERSITY_ADMIN, universityId, Role.COMPANY, companyId, companyId, universityId);
            return;
        }
        PartnershipRow row = existing.get();
        String st = normalizeStatus(row.status());
        if ("APPROVED".equals(st)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already collaborating");
        }
        if ("PENDING".equals(st)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A request is already pending");
        }
        if ("REJECTED".equals(st)) {
            partnershipRepository.patchStatusAndRequester(companyId, universityId, "PENDING", R_COMPANY, companyId);
            notifyPartnershipRequest(Role.UNIVERSITY_ADMIN, universityId, Role.COMPANY, companyId, companyId, universityId);
            return;
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot create request");
    }

    public void respondAsCompany(UserAccount user, int universityId, boolean approve) {
        requireRole(user, Role.COMPANY);
        int companyId = parseCompanyId(user);
        PartnershipRow row = partnershipRepository.findByPair(companyId, universityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No partnership request"));
        if (!"PENDING".equals(normalizeStatus(row.status()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No pending request to answer");
        }
        if (companyRequested(row, companyId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot respond to your own request");
        }
        partnershipRepository.patchStatus(companyId, universityId, approve ? "APPROVED" : "REJECTED");
        int uniId = row.requestedById();
        if (approve) {
            notificationRepository.insertInstitutionalPartnershipNotification(
                    Role.UNIVERSITY_ADMIN,
                    uniId,
                    "Your university's institutional collaboration request was accepted.",
                    Role.COMPANY,
                    companyId,
                    companyId,
                    universityId);
        } else {
            notificationRepository.insertInstitutionalPartnershipNotification(
                    Role.UNIVERSITY_ADMIN,
                    uniId,
                    "Your university's institutional collaboration request was declined.",
                    Role.COMPANY,
                    companyId,
                    companyId,
                    universityId);
        }
    }

    public void endPartnershipAsCompany(UserAccount user, int universityId) {
        requireRole(user, Role.COMPANY);
        int companyId = parseCompanyId(user);
        PartnershipRow row = partnershipRepository.findByPair(companyId, universityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No partnership"));
        if (!"APPROVED".equals(normalizeStatus(row.status()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an active collaboration can be ended");
        }
        partnershipRepository.deleteByPair(companyId, universityId);
        notificationRepository.insertInstitutionalPartnershipNotification(
                Role.UNIVERSITY_ADMIN,
                universityId,
                "Institutional collaboration has ended for your university.",
                Role.COMPANY,
                companyId,
                companyId,
                universityId);
    }

    public InstitutionalPartnershipCompaniesResponse listCompaniesForUniversity(UserAccount user) {
        requireRole(user, Role.UNIVERSITY_ADMIN);
        int universityId = parseUniversityId(user);
        Map<Integer, PartnershipRow> byCo = partnershipRepository.mapByCompanyForUniversity(universityId);
        List<AdminCompanySummaryResponse> companies = universityAdminRepository.listCompanies(5000);
        List<InstitutionalPartnershipCompanyItem> out = new ArrayList<>();
        for (AdminCompanySummaryResponse c : companies) {
            PartnershipRow p = byCo.get(c.companyId());
            out.add(buildCompanyItemForUniversityView(universityId, c.companyId(), c.name(), c.industry(), p));
        }
        return new InstitutionalPartnershipCompaniesResponse(out);
    }

    public void requestPartnershipAsUniversity(UserAccount user, int companyId) {
        requireRole(user, Role.UNIVERSITY_ADMIN);
        int universityId = parseUniversityId(user);
        if (companyId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid company");
        }
        Optional<PartnershipRow> existing = partnershipRepository.findByPair(companyId, universityId);
        if (existing.isEmpty()) {
            partnershipRepository.insertPending(companyId, universityId, R_UNI, universityId);
            notifyPartnershipRequest(Role.COMPANY, companyId, Role.UNIVERSITY_ADMIN, universityId, companyId, universityId);
            return;
        }
        PartnershipRow row = existing.get();
        String st = normalizeStatus(row.status());
        if ("APPROVED".equals(st)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already collaborating");
        }
        if ("PENDING".equals(st)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A request is already pending");
        }
        if ("REJECTED".equals(st)) {
            partnershipRepository.patchStatusAndRequester(companyId, universityId, "PENDING", R_UNI, universityId);
            notifyPartnershipRequest(Role.COMPANY, companyId, Role.UNIVERSITY_ADMIN, universityId, companyId, universityId);
            return;
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot create request");
    }

    public void respondAsUniversity(UserAccount user, int companyId, boolean approve) {
        requireRole(user, Role.UNIVERSITY_ADMIN);
        int universityId = parseUniversityId(user);
        PartnershipRow row = partnershipRepository.findByPair(companyId, universityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No partnership request"));
        if (!"PENDING".equals(normalizeStatus(row.status()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No pending request to answer");
        }
        if (universityRequested(row, universityId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot respond to your own request");
        }
        String newStatus = approve ? "APPROVED" : "REJECTED";
        partnershipRepository.patchStatus(companyId, universityId, newStatus);
        int coId = row.requestedById();
        String uniLabel = universityAdminRepository.findUniversityNameById(universityId).orElse("A university");
        if (approve) {
            notificationRepository.insertInstitutionalPartnershipNotification(
                    Role.COMPANY,
                    coId,
                    uniLabel + " accepted your institutional collaboration request.",
                    Role.UNIVERSITY_ADMIN,
                    universityId,
                    companyId,
                    universityId);
        } else {
            notificationRepository.insertInstitutionalPartnershipNotification(
                    Role.COMPANY,
                    coId,
                    uniLabel + " declined your institutional collaboration request.",
                    Role.UNIVERSITY_ADMIN,
                    universityId,
                    companyId,
                    universityId);
        }
    }

    public void endPartnershipAsUniversity(UserAccount user, int companyId) {
        requireRole(user, Role.UNIVERSITY_ADMIN);
        int universityId = parseUniversityId(user);
        PartnershipRow row = partnershipRepository.findByPair(companyId, universityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No partnership"));
        if (!"APPROVED".equals(normalizeStatus(row.status()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an active collaboration can be ended");
        }
        partnershipRepository.deleteByPair(companyId, universityId);
        notificationRepository.insertInstitutionalPartnershipNotification(
                Role.COMPANY,
                companyId,
                "Institutional collaboration has ended with your organization.",
                Role.UNIVERSITY_ADMIN,
                universityId,
                companyId,
                universityId);
    }

    private void notifyPartnershipRequest(
            Role recipientRole,
            int recipientEntityId,
            Role senderRole,
            int senderEntityId,
            int partnershipCompanyId,
            int partnershipUniversityId
    ) {
        String msg = switch (senderRole) {
            case COMPANY -> "A company requested institutional collaboration with your university.";
            case UNIVERSITY_ADMIN -> "A university requested institutional collaboration with your organization.";
            default -> "Institutional collaboration request.";
        };
        notificationRepository.insertInstitutionalPartnershipNotification(
                recipientRole,
                recipientEntityId,
                msg,
                senderRole,
                senderEntityId,
                partnershipCompanyId,
                partnershipUniversityId);
    }

    private static InstitutionalPartnershipUniversityItem buildUniversityItemForCompanyView(
            int companyId,
            int universityId,
            String universityName,
            PartnershipRow p
    ) {
        if (p == null) {
            return new InstitutionalPartnershipUniversityItem(
                    universityId,
                    universityName,
                    "NONE",
                    null,
                    null,
                    true,
                    false,
                    false,
                    false
            );
        }
        String st = normalizeStatus(p.status());
        boolean coReq = companyRequested(p, companyId);
        boolean pend = "PENDING".equals(st);
        boolean appr = "APPROVED".equals(st);
        boolean canRequest = !pend && !appr;
        return new InstitutionalPartnershipUniversityItem(
                universityId,
                universityName,
                st,
                p.requestedByRole(),
                p.requestedById(),
                canRequest,
                pend && !coReq,
                pend && !coReq,
                appr
        );
    }

    private static InstitutionalPartnershipCompanyItem buildCompanyItemForUniversityView(
            int universityId,
            int companyId,
            String companyName,
            String industry,
            PartnershipRow p
    ) {
        if (p == null) {
            return new InstitutionalPartnershipCompanyItem(
                    companyId,
                    companyName,
                    industry,
                    "NONE",
                    null,
                    null,
                    true,
                    false,
                    false,
                    false
            );
        }
        String st = normalizeStatus(p.status());
        boolean uniReq = universityRequested(p, universityId);
        boolean pend = "PENDING".equals(st);
        boolean appr = "APPROVED".equals(st);
        return new InstitutionalPartnershipCompanyItem(
                companyId,
                companyName,
                industry,
                st,
                p.requestedByRole(),
                p.requestedById(),
                !pend && !appr,
                pend && !uniReq,
                pend && !uniReq,
                appr
        );
    }

    private static boolean companyRequested(PartnershipRow p, int companyId) {
        return R_COMPANY.equals(p.requestedByRole()) && p.requestedById() == companyId;
    }

    private static boolean universityRequested(PartnershipRow p, int universityId) {
        return R_UNI.equals(p.requestedByRole()) && p.requestedById() == universityId;
    }

    private static String normalizeStatus(String s) {
        if (s == null) {
            return "";
        }
        return s.trim().toUpperCase();
    }

    private static void requireRole(UserAccount user, Role expected) {
        if (user == null || user.getRole() != expected) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    private static int parseCompanyId(UserAccount user) {
        try {
            return Integer.parseInt(user.getLinkedEntityId().trim());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Company account is not linked to a company id");
        }
    }

    private static int parseUniversityId(UserAccount user) {
        try {
            return Integer.parseInt(user.getLinkedEntityId().trim());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "University admin is not linked to a university id");
        }
    }
}
