package com.internaal;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InternAlApplication {

  public static void main(String[] args) {
    Dotenv dotenv = Dotenv.configure().directory("./").ignoreIfMissing().load();
    dotenv
        .entries()
        .forEach(
            (e) -> {
              // Always prefer project-local .env values to avoid inheriting stale
              // machine-level placeholders like "${SPRING_DATASOURCE_URL}".
              System.setProperty(e.getKey(), e.getValue());
            });
    SpringApplication.run(InternAlApplication.class, args);
  }
}

