package com.capitalone.chargeback;

import io.camunda.client.api.response.ActivatedJob;
import io.camunda.client.annotation.JobWorker;
import io.camunda.zeebe.spring.common.exception.ZeebeBpmnError;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class WorkflowWorkers {
    private final DisputeRepository disputes;

    @Value("${app.high-value-threshold:4000}")
    BigDecimal highValueThreshold;

    WorkflowWorkers(DisputeRepository disputes) {
        this.disputes = disputes;
    }

    @JobWorker(type = "validate-chargeback")
    public Map<String, Object> validate(ActivatedJob job) {
        var variables = job.getVariablesAsMap();
        Object transactions = variables.get("transactions");
        if (variables.get("caseId") == null
                || !(transactions instanceof List<?> transactionList)
                || transactionList.isEmpty()) {
            throw new ZeebeBpmnError(
                    "INVALID_CHARGEBACK",
                    "A case ID and at least one transaction are required",
                    Map.of("caseId", String.valueOf(variables.get("caseId"))));
        }
        return Map.of("requestValid", true);
    }

    @JobWorker(type = "evaluate-transaction")
    @Transactional
    public Map<String, Object> evaluate(ActivatedJob job) {
        var variables = job.getVariablesAsMap();
        String caseId = String.valueOf(variables.get("caseId"));
        Object transactionValue = variables.get("transaction");
        Object metadataValue = variables.get("transactionMetadata");
        if (!(transactionValue instanceof Map<?, ?> transaction)
                || !(metadataValue instanceof Map<?, ?> metadata)
                || !java.util.Objects.equals(
                        transaction.get("transactionId"), metadata.get("id"))) {
            throw new ZeebeBpmnError(
                    "TRANSACTION_METADATA_ERROR",
                    "Transaction metadata was not found or mismatched",
                    Map.of(
                            "caseId", caseId,
                            "itemId", transactionValue instanceof Map<?, ?> transactionMap
                                    ? String.valueOf(transactionMap.get("itemId"))
                                    : ""));
        }

        var disputeCase = disputes.findById(caseId).orElseThrow();
        var item = disputeCase.items.stream()
                .filter(candidate ->
                        candidate.id.equals(String.valueOf(transaction.get("itemId"))))
                .findFirst()
                .orElseThrow();
        boolean eligible = Boolean.TRUE.equals(metadata.get("eligibleForDispute"));
        boolean highValue = item.amount.compareTo(highValueThreshold) >= 0;
        item.status = eligible ? "PENDING_MERCHANT" : "REJECTED";
        item.decision = eligible ? "PENDING_MERCHANT" : "REJECTED";
        item.fraudAlertStatus = highValue ? "PENDING" : "NOT_REQUIRED";
        return Map.of(
                "eligible", eligible,
                "highValue", highValue,
                "itemId", item.id);
    }

    @JobWorker(type = "record-ineligible-transaction")
    @Transactional
    public void recordIneligible(ActivatedJob job) {
        updateItem(job, item -> {
            item.status = "REJECTED";
            item.decision = "REJECTED";
        });
    }

    @JobWorker(type = "record-transaction-failure")
    @Transactional
    public void recordTransactionFailure(ActivatedJob job) {
        updateItem(job, item -> {
            item.status = "FAILED";
            item.decision = "FAILED";
        });
    }

    @JobWorker(type = "send-merchant-request")
    public Map<String, Object> merchantRequest(ActivatedJob job) {
        return Map.of("merchantRequestSent", true);
    }

    @JobWorker(type = "evaluate-merchant-response")
    @Transactional
    public Map<String, Object> merchantDecision(ActivatedJob job) {
        var variables = job.getVariablesAsMap();
        var disputeCase = disputes.findById(String.valueOf(variables.get("caseId")))
                .orElseThrow();
        String itemId = itemId(variables);
        var item = disputeCase.items.stream()
                .filter(candidate -> candidate.id.equals(itemId))
                .findFirst()
                .orElseThrow();
        String responseVariable = "merchantAccepted_" + itemId.replaceAll("[^A-Za-z0-9_]", "_");
        boolean accepted = Boolean.TRUE.equals(variables.get(responseVariable));
        item.merchantResponse = accepted ? "ACCEPTED" : "CONTESTED";
        item.decision = accepted ? "APPROVED" : "REJECTED";
        item.status = item.decision;
        return Map.of("approved", accepted, "itemId", itemId);
    }

    @JobWorker(type = "record-merchant-timeout")
    @Transactional
    public Map<String, Object> merchantTimeout(ActivatedJob job) {
        var variables = job.getVariablesAsMap();
        var disputeCase = disputes.findById(String.valueOf(variables.get("caseId")))
                .orElseThrow();
        String itemId = itemId(variables);
        var item = disputeCase.items.stream()
                .filter(candidate -> candidate.id.equals(itemId))
                .findFirst()
                .orElseThrow();
        item.merchantResponse = "TIMEOUT";
        item.decision = "REJECTED";
        item.status = "REJECTED";
        return Map.of("approved", false, "itemId", itemId);
    }

    @JobWorker(type = "ledger-reversal")
    @Transactional
    public Map<String, Object> reversal(ActivatedJob job) {
        var variables = job.getVariablesAsMap();
        var disputeCase = disputes.findById(String.valueOf(variables.get("caseId")))
                .orElseThrow();
        String itemId = itemId(variables);
        var item = disputeCase.items.stream()
                .filter(candidate -> candidate.id.equals(itemId))
                .findFirst()
                .orElseThrow();
        if (!"APPROVED".equals(item.decision)) {
            throw new ZeebeBpmnError(
                    "LEDGER_REVERSAL_FAILED",
                    "Only approved dispute items may be reversed",
                    Map.of("caseId", String.valueOf(variables.get("caseId")), "itemId", itemId));
        }
        item.refundStatus = "REFUNDED";
        item.status = "REFUNDED";
        return Map.of("reversalSuccessful", true);
    }

    @JobWorker(type = "record-ledger-failure")
    @Transactional
    public void recordLedgerFailure(ActivatedJob job) {
        updateItem(job, item -> {
            item.refundStatus = "FAILED";
            item.status = "REVERSAL_FAILED";
        });
    }

    @JobWorker(type = "record-invalid-case")
    @Transactional
    public void recordInvalidCase(ActivatedJob job) {
        var disputeCase = disputes.findById(
                String.valueOf(job.getVariablesAsMap().get("caseId"))).orElseThrow();
        disputeCase.status = "FAILED";
    }

    @JobWorker(type = "notify-customer")
    @Transactional
    public void notifyCustomer(ActivatedJob job) {
        var disputeCase = disputes.findById(
                String.valueOf(job.getVariablesAsMap().get("caseId"))).orElseThrow();
        disputeCase.status = "COMPLETED";
    }

    private void updateItem(ActivatedJob job, java.util.function.Consumer<DisputeItem> update) {
        var variables = job.getVariablesAsMap();
        var disputeCase = disputes.findById(String.valueOf(variables.get("caseId")))
                .orElseThrow();
        String itemId = itemId(variables);
        disputeCase.items.stream()
                .filter(item -> item.id.equals(itemId))
                .findFirst()
                .ifPresentOrElse(
                        update,
                        () -> {
                            throw new IllegalStateException(
                                    "Dispute item not found for workflow item ID " + itemId);
                        });
    }

    private String itemId(Map<String, Object> variables) {
        Object directItemId = variables.get("itemId");
        if (directItemId != null) {
            return String.valueOf(directItemId);
        }
        Object transactionValue = variables.get("transaction");
        if (transactionValue instanceof Map<?, ?> transaction
                && transaction.get("itemId") != null) {
            return String.valueOf(transaction.get("itemId"));
        }
        throw new IllegalStateException("Workflow item ID is missing from the task context");
    }
}
