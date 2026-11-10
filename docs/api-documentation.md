# REST API reference

The API is served by Spring Boot on port 8080. Successful endpoints return JSON bodies as well as an HTTP status; error responses include an `error` field. Validation and missing-record errors return HTTP 400. A workflow action that requires Camunda while no client is available returns HTTP 503.

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

## HTTP requests and responses

The transaction metadata REST Connector sends a `GET /api/transactions/{id}` request and receives HTTP `200 OK` with the transaction JSON body. Its result expression maps `body` to `transactionMetadata`; the eligibility worker consumes its `id` and `eligibleForDispute` fields.

The high-value alert REST Connector sends a JSON `POST /api/fraud/alerts` request and receives HTTP `202 Accepted` with a JSON result, for example:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json
```

```json
{
  "recorded": true,
  "slackNotificationStatus": "NOT_CONFIGURED"
}
```

The connector result expression maps `body` to `fraudAlertResult`. `202` is a successful 2xx response for the HTTP JSON Connector. The body reports the recorded outcome and optional Slack delivery state; no success response is fabricated when input validation fails.

Creating a case returns `201 Created`, the serialized case body, and a `Location: /api/disputes/{id}` header. Publishing a merchant response returns `202 Accepted` with `{"status":"correlated"}` after Camunda acknowledges the message. These endpoints require their corresponding external workflow configuration.

If a merchant-response request targets an item that is awaiting a response but the application has no Camunda client, the API returns `503 Service Unavailable` with an `error` message instead of reporting a false correlation success.

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
