package com.internaal;

import com.internaal.config.RepoRootDotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InternalBackendApplication {

    public static void main(String[] args) {
        RepoRootDotenv.loadIfPresent();
        SpringApplication.run(InternalBackendApplication.class, args);
    }
}
