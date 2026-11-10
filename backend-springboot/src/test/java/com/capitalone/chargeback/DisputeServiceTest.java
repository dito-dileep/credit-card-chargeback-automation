package com.capitalone.chargeback;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "app.workflow-enabled=false",
        "camunda.client.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class DisputeServiceTest {
    @Autowired
    DisputeService service;

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
}
