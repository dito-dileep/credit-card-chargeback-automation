package com.capitalone.chargeback;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.FetchType;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY)
class CardTransaction {
    @Id
    String id;
    String customerId;
    String merchant;
    BigDecimal amount;
    LocalDate date;
    String status = "POSTED";
    boolean eligibleForDispute = true;
    boolean disputed;

    CardTransaction() {
    }

    CardTransaction(String id, String merchant, String amount) {
        this.id = id;
        this.customerId = "customer-001";
        this.merchant = merchant;
        this.amount = new BigDecimal(amount);
        this.date = LocalDate.now().minusDays(2);
    }
}

@Entity
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY)
class DisputeCase {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;
    String customerId;
    Instant createdAt = Instant.now();
    String status = "SUBMITTED";
    String workflowInstanceId;

    @OneToMany(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    List<DisputeItem> items = new ArrayList<>();
}

@Entity
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY)
class DisputeItem {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;
    String transactionId;
    String reason;
    String merchant;
    BigDecimal amount;
    String status = "PENDING";
    String decision = "PENDING";
    String refundStatus = "NOT_STARTED";
    String merchantResponse;
    String fraudAlertStatus = "NOT_REQUIRED";
}

interface TransactionRepository extends JpaRepository<CardTransaction, String> {
}

interface DisputeRepository extends JpaRepository<DisputeCase, String> {
}

record DisputeLine(String transactionId, String reason) {
}

record CreateDisputeRequest(String customerId, List<DisputeLine> items) {
}

record MerchantResponseRequest(boolean accepted) {
}

record FraudAlertRequest(String caseId, String itemId, String transactionId, BigDecimal amount) {
}

record FraudAlertResult(boolean recorded, String slackNotificationStatus) {
}

record WorkflowTask(
        String id,
        String caseId,
        String transactionId,
        String merchant,
        BigDecimal amount,
        String status) {
}

record DashboardSummary(long openDisputes, long approved, long rejected, long alerts) {
}
