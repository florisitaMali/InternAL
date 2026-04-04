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

    private final JWSVerifier verifier;
    private final UserAccountRepository userAccountRepository;

    public JwtAuthenticationFilter(
            @Value("${supabase.url}") String supabaseUrl,
            UserAccountRepository userAccountRepository) throws Exception {
        JWKSet jwkSet = JWKSet.load(new URL(supabaseUrl + "/auth/v1/.well-known/jwks.json"));
        ECKey ecKey = (ECKey) jwkSet.getKeys().get(0);
        this.verifier = new ECDSAVerifier(ecKey);
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            SignedJWT signedJWT = SignedJWT.parse(token);

            // Step 1: Verify JWT signature
            if (!signedJWT.verify(verifier)) {
                sendError(response, HttpStatus.UNAUTHORIZED, "Invalid token signature");
                return;
            }

            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();

            // Step 2: Check token expiration
            Date expiration = claims.getExpirationTime();
            if (expiration != null && expiration.before(new Date())) {
                sendError(response, HttpStatus.UNAUTHORIZED, "Token expired");
                return;
            }

            // Step 3: Extract user identifier
            // NOTE: Currently resolving by email. To switch to Supabase user ID later,
            // change this to claims.getSubject() and use findBySupabaseUserId() instead.
            String userIdentifier = resolveUserIdentifier(claims);
            if (userIdentifier == null) {
                sendError(response, HttpStatus.UNAUTHORIZED, "No user identifier in token");
                return;
            }

            // Step 4: Look up internal useraccount (pass user's JWT to satisfy RLS)
            Optional<UserAccount> account = userAccountRepository.findByEmail(userIdentifier, token);
            if (account.isEmpty()) {
                sendError(response, HttpStatus.FORBIDDEN, "No matching account found");
                return;
            }

            UserAccount user = account.get();

            // Step 5: Validate role exists
            if (user.getRole() == null) {
                sendError(response, HttpStatus.FORBIDDEN, "Account has no role assigned");
                return;
            }

            // Step 6: Validate linked entity
            if (user.getLinkedEntityId() == null) {
                sendError(response, HttpStatus.FORBIDDEN, "Account has no linked entity");
                return;
            }

            // Step 7: Build authenticated principal and set security context
            String role = "ROLE_" + user.getRole().name();
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                            user, null,
                            List.of(new SimpleGrantedAuthority(role)));

            SecurityContextHolder.getContext().setAuthentication(auth);
            filterChain.doFilter(request, response);

        } catch (Exception e) {
            log.error("JWT validation failed: {}", e.getMessage());
            SecurityContextHolder.clearContext();
            sendError(response, HttpStatus.UNAUTHORIZED, "Token validation failed");
        }
    }

    /**
     * Resolves the user identifier from JWT claims.
     *
     * Currently uses the "email" claim. To migrate to Supabase user ID:
     * 1. Add a supabase_user_id column to the useraccount table
     * 2. Change this method to return claims.getSubject()
     * 3. Update UserAccountRepository to use findBySupabaseUserId()
     */
    private String resolveUserIdentifier(JWTClaimsSet claims) throws java.text.ParseException {
        return claims.getStringClaim("email");
    }

    private void sendError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType("application/json");
        response.getWriter().write("{\"error\": \"" + message + "\"}");
    }
}
