# REST API reference

The API is served by Spring Boot on port 8080. Error responses include an `error` field. Validation and missing-record errors return HTTP 400.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/transactions` | List statement lines, including dispute eligibility and disputed state |
| GET | `/api/transactions/{id}` | Return one transaction's metadata; called by the Camunda REST Connector |
| POST | `/api/disputes` | Validate and create one case containing multiple transaction lines |
| GET | `/api/disputes` | List cases and their item outcomes |
| GET | `/api/disputes/{id}` | Return a case and workflow instance key |
| GET | `/api/disputes/{id}/transactions` | Return item-level decisions, merchant responses, and refund status |
| GET | `/api/tasklist` | List workflow items currently waiting for merchant responses |
| POST | `/api/disputes/{caseId}/transactions/{itemId}/merchant-response` | Publish a correlated merchant response |
| POST | `/api/fraud/alerts` | Validate and record a high-value alert; optionally send a Slack webhook |
| GET | `/api/refunds/{itemId}` | Return one item's refund outcome |
| GET | `/api/dashboard/summary` | Return open cases, approvals, rejections, and high-value item counts |

## Create a multi-transaction case

```json
{
  "customerId": "customer-001",
  "items": [
    { "transactionId": "txn-amazon", "reason": "FRAUD" },
    { "transactionId": "txn-flipkart", "reason": "DUPLICATE" }
  ]
}
```

Allowed reasons are `FRAUD`, `MERCHANDISE_NOT_RECEIVED`, and `DUPLICATE`. The API rejects empty cases, unsupported reasons, duplicate IDs, missing transactions, transactions owned by another customer, and previously disputed transactions. When workflow execution is enabled, a missing Camunda client or failed process start returns an error rather than a success-shaped response.

## Transaction metadata

`GET /api/transactions/{id}` returns a `CardTransaction` JSON object with `id`, `customerId`, `merchant`, `amount`, `date`, `status`, `eligibleForDispute`, and `disputed`. The BPMN REST Connector stores the response body as `transactionMetadata` within the current multi-instance iteration.

## Correlate merchant responses

```json
{ "accepted": true }
```

The response is correlated to `merchantResponse` using the transaction ID. An accepted merchant decision approves the item and enables the ledger Call Activity. A contested decision rejects it. A response for an item that is not waiting for a merchant response is rejected.

## Record a fraud alert

The BPMN REST Connector posts a request containing `caseId`, `itemId`, `transactionId`, and `amount`. The endpoint verifies that the item belongs to the case and that the amount meets the configured high-value threshold. It returns the explicit `slackNotificationStatus` value `SENT`, `NOT_CONFIGURED`, or `FAILED`.
