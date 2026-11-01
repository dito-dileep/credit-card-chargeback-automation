# API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/transactions` | statement lines |
| POST | `/api/disputes` | create one case from `{customerId, items:[{transactionId,reason}]}` |
| GET | `/api/disputes` | case list |
| GET | `/api/disputes/{id}` | case and workflow ID |
| GET | `/api/disputes/{id}/transactions` | line-item statuses |
| GET | `/api/refunds/{itemId}` | refund result |
| GET | `/api/dashboard/summary` | monitoring counts |

Invalid input returns HTTP 400 with an `error` field.
