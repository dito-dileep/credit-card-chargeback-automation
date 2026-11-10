package com.capitalone.chargeback;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@CrossOrigin
class ApiController {
    private final DisputeService service;
    private final TransactionRepository transactions;

    ApiController(DisputeService service, TransactionRepository transactions) {
        this.service = service;
        this.transactions = transactions;
    }

    @GetMapping("/transactions")
    List<CardTransaction> transactions() {
        return transactions.findAll();
    }

    @GetMapping("/transactions/{id}")
    CardTransaction transaction(@PathVariable String id) {
        return transactions.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Transaction not found"));
    }

    @PostMapping("/disputes")
    ResponseEntity<DisputeCase> create(@RequestBody CreateDisputeRequest request) {
        DisputeCase disputeCase = service.create(request);
        return ResponseEntity.created(URI.create("/api/disputes/" + disputeCase.id))
                .body(disputeCase);
    }

    @GetMapping("/disputes")
    List<DisputeCase> list() {
        return service.all();
    }

    @GetMapping("/disputes/{id}")
    DisputeCase get(@PathVariable String id) {
        return service.one(id);
    }

    @GetMapping("/disputes/{id}/transactions")
    List<DisputeItem> items(@PathVariable String id) {
        return service.one(id).items;
    }

    @PostMapping("/disputes/{caseId}/transactions/{itemId}/merchant-response")
    @ResponseStatus(HttpStatus.ACCEPTED)
    Map<String, String> respondToMerchant(
            @PathVariable String caseId,
            @PathVariable String itemId,
            @RequestBody MerchantResponseRequest request) {
        service.respondToMerchant(caseId, itemId, request.accepted());
        return Map.of("status", "correlated");
    }

    @GetMapping("/tasklist")
    List<WorkflowTask> tasklist() {
        return service.tasklist();
    }

    @PostMapping("/fraud/alerts")
    ResponseEntity<FraudAlertResult> fraudAlert(@RequestBody FraudAlertRequest request) {
        return ResponseEntity.accepted().body(service.recordFraudAlert(request));
    }

    @GetMapping("/refunds/{itemId}")
    DisputeItem refund(@PathVariable String itemId) {
        return service.refund(itemId);
    }

    @GetMapping("/dashboard/summary")
    DashboardSummary summary() {
        return service.summary();
    }

    @ExceptionHandler({IllegalArgumentException.class, NoSuchElementException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    Map<String, String> error(Exception exception) {
        return Map.of("error", exception.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    Map<String, String> workflowUnavailable(IllegalStateException exception) {
        return Map.of("error", exception.getMessage());
    }
}
