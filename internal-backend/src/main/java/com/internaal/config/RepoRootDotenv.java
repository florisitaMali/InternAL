package com.internaal.config;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Loads monorepo root {@code .env} before Spring so placeholders resolve. Tries
 * {@code ../.env} when cwd is {@code internal-backend/}, then {@code ./.env} at repo root.
 * Skips empty values so {@code SUPABASE_URL=} does not block {@code NEXT_PUBLIC_*} fallbacks.
 * Values from the repo root file win over inherited shell variables to keep local dev consistent.
 */
public final class RepoRootDotenv {

    private RepoRootDotenv() {}

    public static void loadIfPresent() {
        Path userDir = Path.of(System.getProperty("user.dir", "."));
        Path[] candidates = {
            userDir.resolve("..").normalize().resolve(".env"),
            userDir.resolve(".env"),
        };
        for (Path envFile : candidates) {
            if (!Files.isRegularFile(envFile)) {
                continue;
            }
            try (BufferedReader r = Files.newBufferedReader(envFile)) {
                String line;
                while ((line = r.readLine()) != null) {
                    line = line.strip();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }
                    int eq = line.indexOf('=');
                    if (eq <= 0) {
                        continue;
                    }
                    String key = line.substring(0, eq).strip();
                    if (key.isEmpty()) {
                        continue;
                    }
                    String value = line.substring(eq + 1).strip();
                    if (value.length() >= 2
                            && ((value.startsWith("\"") && value.endsWith("\""))
                                || (value.startsWith("'") && value.endsWith("'")))) {
                        value = value.substring(1, value.length() - 1);
                    }
                    if (value.isEmpty()) {
                        continue;
                    }
                    System.setProperty(key, value);
                }
            } catch (IOException ignored) {
                /* leave env as-is */
            }
            return;
        }
    }
}
