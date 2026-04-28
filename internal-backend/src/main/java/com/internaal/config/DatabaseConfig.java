package com.internaal.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.net.http.HttpClient;

@Configuration
public class DatabaseConfig {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Bean
    public String supabaseUrl() {
        return supabaseUrl;
    }

    @Bean
    public String supabaseAnonKey() {
        return supabaseAnonKey;
    }

    /**
     * Default {@link RestTemplate} uses {@link java.net.HttpURLConnection}, which throws
     * {@code ProtocolException: Invalid HTTP method: PATCH}. PostgREST updates require PATCH.
     */
    @Bean
    public RestTemplate restTemplate() {
        HttpClient httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        return new RestTemplate(factory);
    }
}
