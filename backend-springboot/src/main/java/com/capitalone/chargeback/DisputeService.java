package com.capitalone.chargeback;

import io.camunda.client.CamundaClient;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
class DisputeService {
    private static final Logger logger = LoggerFactory.getLogger(DisputeService.class);
    private static final Set<String> ALLOWED_REASONS =
            Set.of("FRAUD", "MERCHANDISE_NOT_RECEIVED", "DUPLICATE");

    private final TransactionRepository transactions;
    private final DisputeRepository disputes;
    private final Optional<CamundaClient> client;

    @Value("${app.workflow-enabled:false}")
    boolean workflowEnabled;

    @Value("${app.merchant-timeout:P3D}")
    String merchantTimeout;

    @Value("${app.transaction-api-base-url:http://localhost:8080}")
    String transactionApiBaseUrl;

    @Value("${app.high-value-threshold:4000}")
    BigDecimal highValueThreshold;

    @Value("${app.slack-webhook-url:}")
    String slackWebhookUrl;

    DisputeService(
            TransactionRepository transactions,
            DisputeRepository disputes,
            ObjectProvider<CamundaClient> clientProvider) {
        this.transactions = transactions;
        this.disputes = disputes;
        this.client = Optional.ofNullable(clientProvider.getIfAvailable());
    }

    @Transactional
    DisputeCase create(CreateDisputeRequest request) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Select at least one transaction");
        }

        var disputeCase = new DisputeCase();
        disputeCase.customerId =
                request.customerId() == null ? "customer-001" : request.customerId();
        Set<String> selectedIds = new HashSet<>();

        for (var line : request.items()) {
            if (line == null || line.transactionId() == null || line.transactionId().isBlank()) {
                throw new IllegalArgumentException("A transaction ID is required");
            }
            if (line.reason() == null || !ALLOWED_REASONS.contains(line.reason())) {
                throw new IllegalArgumentException("Select a supported dispute reason");
            }
            if (!selectedIds.add(line.transactionId())) {
                throw new IllegalArgumentException("Duplicate transaction in claim");
            }

            var transaction = transactions.findById(line.transactionId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Transaction not found: " + line.transactionId()));
            if (!transaction.customerId.equals(disputeCase.customerId)) {
                throw new IllegalArgumentException("Transaction does not belong to customer");
            }
            if (transaction.disputed) {
                throw new IllegalArgumentException(
                        "Transaction already disputed: " + transaction.id);
            }

            transaction.disputed = true;
            var item = new DisputeItem();
            item.transactionId = transaction.id;
            item.merchant = transaction.merchant;
            item.amount = transaction.amount;
            item.reason = line.reason();
            disputeCase.items.add(item);
        }

        disputeCase = disputes.save(disputeCase);
        if (workflowEnabled) {
            CamundaClient camunda = client.orElseThrow(() ->
                    new IllegalStateException(
                            "Workflow is enabled but no Camunda client is available"));
            var process = camunda.newCreateInstanceCommand()
                    .bpmnProcessId("chargeback-dispute")
                    .latestVersion()
                    .variables(Map.of(
                            "caseId", disputeCase.id,
                            "merchantTimeout", merchantTimeout,
                            "transactionApiBaseUrl", normalizedTransactionApiBaseUrl(),
                            "transactions", disputeCase.items.stream()
                                    .map(item -> Map.of(
                                            "itemId", item.id,
                                            "transactionId", item.transactionId,
                                            "amount", item.amount,
                                            "reason", item.reason))
                                    .toList()))
                    .send()
                    .join();
            disputeCase.workflowInstanceId =
                    String.valueOf(process.getProcessInstanceKey());
        }
        return disputeCase;
    }

    List<DisputeCase> all() {
        return disputes.findAll();
    }

    DisputeCase one(String id) {
        return disputes.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Dispute not found"));
    }

    DisputeItem refund(String itemId) {
        return all().stream()
                .flatMap(disputeCase -> disputeCase.items.stream())
                .filter(item -> item.id.equals(itemId))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Dispute item not found"));
    }

    List<WorkflowTask> tasklist() {
        return all().stream()
                .filter(disputeCase -> disputeCase.workflowInstanceId != null)
                .flatMap(disputeCase -> disputeCase.items.stream()
                        .filter(item -> "PENDING_MERCHANT".equals(item.status))
                        .map(item -> new WorkflowTask(
                                item.id,
                                disputeCase.id,
                                item.transactionId,
                                item.merchant,
                                item.amount,
                                item.status)))
                .toList();
    }

    void respondToMerchant(String caseId, String itemId, boolean accepted) {
        var disputeCase = one(caseId);
        var item = disputeCase.items.stream()
                .filter(candidate -> candidate.id.equals(itemId))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Dispute item not found"));
        if (!"PENDING_MERCHANT".equals(item.status)) {
            throw new IllegalArgumentException(
                    "This item is not waiting for a merchant response");
        }

        CamundaClient camunda = client.orElseThrow(() ->
                new IllegalStateException(
                        "Merchant responses require an active Camunda client"));
        String responseVariable = "merchantAccepted_" + item.id.replaceAll("[^A-Za-z0-9_]", "_");
        camunda.newPublishMessageCommand()
                .messageName("merchantResponse")
                .correlationKey(item.transactionId)
                .variables(Map.of(responseVariable, accepted))
                .timeToLive(Duration.ofDays(3))
                .messageId(UUID.randomUUID().toString())
                .send()
                .join();
    }

    @Transactional
    FraudAlertResult recordFraudAlert(FraudAlertRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Fraud alert details are required");
        }
        var disputeCase = one(request.caseId());
        var item = disputeCase.items.stream()
                .filter(candidate -> candidate.id.equals(request.itemId())
                        && candidate.transactionId.equals(request.transactionId()))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Dispute item not found"));
        if (item.amount.compareTo(highValueThreshold) < 0
                || request.amount() == null
                || item.amount.compareTo(request.amount()) != 0) {
            throw new IllegalArgumentException("Fraud alert amount does not match the transaction");
        }

        String slackStatus = "NOT_CONFIGURED";
        if (slackWebhookUrl != null && !slackWebhookUrl.isBlank()) {
            try {
                RestClient.create().post()
                        .uri(slackWebhookUrl)
                        .body(Map.of("text", String.format(
                                "High-value dispute alert: %s (%s), amount %s, case %s",
                                item.merchant,
                                item.transactionId,
                                item.amount,
                                disputeCase.id)))
                        .retrieve()
                        .toBodilessEntity();
                slackStatus = "SENT";
            } catch (RestClientException exception) {
                logger.error("Slack fraud alert delivery failed for dispute item {}",
                        item.id, exception);
                slackStatus = "FAILED";
            }
        }

        item.fraudAlertStatus = slackStatus;
        return new FraudAlertResult(true, slackStatus);
    }

    DashboardSummary summary() {
        var cases = all();
        Stream<DisputeItem> items = cases.stream().flatMap(disputeCase -> disputeCase.items.stream());
        List<DisputeItem> allItems = items.toList();
        return new DashboardSummary(
                cases.stream().filter(disputeCase -> !"COMPLETED".equals(disputeCase.status)).count(),
                allItems.stream().filter(item -> "APPROVED".equals(item.decision)).count(),
                allItems.stream().filter(item -> "REJECTED".equals(item.decision)).count(),
                allItems.stream()
                        .filter(item -> item.amount.compareTo(highValueThreshold) >= 0)
                        .count());
    }

    private String normalizedTransactionApiBaseUrl() {
        return transactionApiBaseUrl.replaceAll("/+$", "");
    }
}
