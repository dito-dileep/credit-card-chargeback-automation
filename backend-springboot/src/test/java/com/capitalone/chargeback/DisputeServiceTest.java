package com.capitalone.chargeback;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.workflow-enabled=false",
        "camunda.client.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class DisputeServiceTest {
    @Autowired
    DisputeService service;

    @Autowired
    TestRestTemplate http;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    TransactionRepository transactions;

    @Autowired
    DisputeRepository disputes;

    @Value("${local.server.port}")
    int port;

    @BeforeEach
    void resetFixtures() {
        disputes.deleteAll();
        var fixtureTransactions = transactions.findAll();
        fixtureTransactions.forEach(transaction -> transaction.disputed = false);
        transactions.saveAll(fixtureTransactions);
    }

    @Test
    void createsMultiTransactionCase() {
        var disputeCase = service.create(new CreateDisputeRequest(
                "customer-001",
                List.of(
                        new DisputeLine("txn-amazon", "FRAUD"),
                        new DisputeLine("txn-flipkart", "FRAUD"))));

        assertEquals(2, disputeCase.items.size());
        assertEquals("SUBMITTED", disputeCase.status);
    }

    @Test
    void rejectsMissingReason() {
        assertThrows(IllegalArgumentException.class, () -> service.create(
                new CreateDisputeRequest(
                        "customer-001",
                        List.of(new DisputeLine("txn-restaurant", "")))));
    }

    @Test
    void rejectsUnsupportedReason() {
        assertThrows(IllegalArgumentException.class, () -> service.create(
                new CreateDisputeRequest(
                        "customer-001",
                        List.of(new DisputeLine("txn-restaurant", "OTHER")))));
    }

    @Test
    void rejectsRepeatedTransactionInCase() {
        assertThrows(IllegalArgumentException.class, () -> service.create(
                new CreateDisputeRequest(
                        "customer-001",
                        List.of(
                                new DisputeLine("txn-restaurant", "FRAUD"),
                                new DisputeLine("txn-restaurant", "DUPLICATE")))));
    }

    @Test
    void liveMetadataApiReturnsHttpOkAndJsonBody() {
        var response = http.getForEntity(
                "http://localhost:" + port + "/api/transactions/txn-amazon",
                String.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(MediaType.APPLICATION_JSON, response.getHeaders().getContentType());
        assertTrue(response.getBody().contains("\"merchant\":\"Amazon India\""));
        assertTrue(response.getBody().contains("\"eligibleForDispute\":true"));
    }

    @Test
    void liveFraudApiReturnsHttp202AndRecordedJsonResult() throws Exception {
        var createHeaders = new HttpHeaders();
        createHeaders.setContentType(MediaType.APPLICATION_JSON);
        var createRequest = Map.of(
                "customerId", "customer-001",
                "items", List.of(Map.of(
                                "transactionId", "txn-flipkart",
                                "reason", "FRAUD")));
        var created = http.postForEntity(
                "http://localhost:" + port + "/api/disputes",
                new HttpEntity<>(createRequest, createHeaders),
                String.class);

        assertEquals(HttpStatus.CREATED, created.getStatusCode());
        assertTrue(created.getHeaders().getLocation().toString().contains("/api/disputes/"));
        var createdCase = objectMapper.readTree(created.getBody());
        String caseId = createdCase.path("id").asText();
        String itemId = createdCase.path("items").get(0).path("id").asText();

        var fraudRequest = Map.of(
                "caseId", caseId,
                "itemId", itemId,
                "transactionId", "txn-flipkart",
                "amount", new BigDecimal("5000"));
        var accepted = http.postForEntity(
                "http://localhost:" + port + "/api/fraud/alerts",
                new HttpEntity<>(fraudRequest, createHeaders),
                String.class);

        assertEquals(HttpStatus.ACCEPTED, accepted.getStatusCode());
        assertEquals(MediaType.APPLICATION_JSON, accepted.getHeaders().getContentType());
        var result = objectMapper.readTree(accepted.getBody());
        assertEquals(true, result.path("recorded").asBoolean());
        assertEquals("NOT_CONFIGURED", result.path("slackNotificationStatus").asText());

        fraudRequest = Map.of(
                "caseId", caseId,
                "itemId", itemId,
                "transactionId", "txn-flipkart",
                "amount", new BigDecimal("1"));
        var rejected = http.postForEntity(
                "http://localhost:" + port + "/api/fraud/alerts",
                new HttpEntity<>(fraudRequest, createHeaders),
                String.class);
        assertEquals(HttpStatus.BAD_REQUEST, rejected.getStatusCode());
        assertTrue(rejected.getBody().contains("\"error\""));

        var items = http.getForEntity(
                "http://localhost:" + port + "/api/disputes/" + caseId + "/transactions",
                String.class);
        assertEquals(HttpStatus.OK, items.getStatusCode());
        assertEquals(
                "NOT_CONFIGURED",
                objectMapper.readTree(items.getBody()).get(0)
                                .path("fraudAlertStatus").asText());
    }
}
