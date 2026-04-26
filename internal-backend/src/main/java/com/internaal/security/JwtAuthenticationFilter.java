package com.internaal.security;

import com.internaal.entity.UserAccount;
import com.internaal.repository.UserAccountRepository;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URL;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JWKSet jwkSet;
    private final UserAccountRepository userAccountRepository;

    @Value("${supabase.url}")
    private String supabaseUrl;

    public JwtAuthenticationFilter(@Value("${supabase.url}") String supabaseUrl,
                                   UserAccountRepository userAccountRepository) throws Exception {
        // Load JWKS from Supabase
        this.jwkSet = JWKSet.load(new URL(supabaseUrl + "/auth/v1/.well-known/jwks.json"));
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            String uri = request.getRequestURI();
            if (uri != null && uri.startsWith("/api/company") && !"OPTIONS".equalsIgnoreCase(request.getMethod())) {
                log.warn("Missing Bearer token on {} {} (browser must send Authorization header)", request.getMethod(), uri);
            }
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        UserAccount user;

        try {
            SignedJWT signedJWT = SignedJWT.parse(token);

            // ✅ Step 1: Get the kid from token header
            String kid = signedJWT.getHeader().getKeyID();
            if (kid == null) {
                sendError(response, HttpStatus.UNAUTHORIZED, "Missing key ID (kid)");
                return;
            }

            // ✅ Step 2: Find corresponding key in JWKS
            ECKey ecKey = (ECKey) jwkSet.getKeyByKeyId(kid);
            if (ecKey == null) {
                sendError(response, HttpStatus.UNAUTHORIZED, "Invalid token key");
                return;
            }

            // ✅ Step 3: Verify signature
            JWSVerifier verifier = new ECDSAVerifier(ecKey);
            if (!signedJWT.verify(verifier)) {
                sendError(response, HttpStatus.UNAUTHORIZED, "Invalid token signature");
                return;
            }

            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();

            // ✅ Step 4: Validate expiration
            Date expiration = claims.getExpirationTime();
            if (expiration != null && expiration.before(new Date())) {
                sendError(response, HttpStatus.UNAUTHORIZED, "Token expired");
                return;
            }

            // ✅ Step 5: Validate issuer
            String issuer = claims.getIssuer();
            if (!issuer.equals(supabaseUrl + "/auth/v1")) {
                sendError(response, HttpStatus.UNAUTHORIZED, "Invalid issuer");
                return;
            }

            // ✅ Step 6: Extract user identifier (email or sub)
            String userIdentifier = claims.getStringClaim("email");
            if (userIdentifier == null) {
                sendError(response, HttpStatus.UNAUTHORIZED, "No user identifier in token");
                return;
            }

            // ✅ Step 7: Lookup internal user account
            Optional<UserAccount> account = userAccountRepository.findByEmail(userIdentifier, token);
            if (account.isEmpty()) {
                sendError(response, HttpStatus.FORBIDDEN, "No matching account found");
                return;
            }

            user = account.get();

            // ✅ Step 8: Validate role and linked entity
            if (user.getRole() == null) {
                sendError(response, HttpStatus.FORBIDDEN, "Account has no role assigned");
                return;
            }
            if (user.getLinkedEntityId() == null) {
                sendError(response, HttpStatus.FORBIDDEN, "Account has no linked entity");
                return;
            }

            // ✅ Step 9: Build Authentication token and set context
            // Store the raw JWT in credentials so repositories can reuse it for Supabase REST calls.
            String role = "ROLE_" + user.getRole().name();
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(user, token,
                            List.of(new SimpleGrantedAuthority(role)));

            SecurityContextHolder.getContext().setAuthentication(auth);

        } catch (Exception e) {
            log.error("JWT validation failed: {}", e.getMessage());
            SecurityContextHolder.clearContext();
            sendError(response, HttpStatus.UNAUTHORIZED, "Token validation failed");
            return;
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void sendError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType("application/json");
        response.getWriter().write("{\"error\": \"" + message + "\"}");
    }
}
