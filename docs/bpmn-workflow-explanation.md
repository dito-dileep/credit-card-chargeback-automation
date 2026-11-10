# BPMN workflow explanation

The executable `chargeback-dispute` process validates the case, then starts a **parallel multi-instance** embedded subprocess using `=transactions` and the local loop variable `transaction`. Each iteration has its own transaction/item IDs and metadata response.

The metadata and fraud-alert tasks use the Camunda **REST Connector** element template (`io.camunda.connectors.HttpJson.v2`, version 11) and connector type `io.camunda:http-json:1`. They are Connector tasks with the modeler marker/icon, not ordinary `@JobWorker` service tasks. The first calls `GET /api/transactions/{id}`. The second calls `POST /api/fraud/alerts` only when `=highValue = true`.

The eligibility gateway has complementary conditions: `=eligible = true` enters the Merchant Representment Window subprocess; `=eligible = false` records a rejection. The subprocess sends a simulated request and waits for the `merchantResponse` message correlated by transaction ID. Its interrupting boundary timer evaluates `=duration(merchantTimeout)`; the timeout worker records a rejected item so the following approval gateway always has a Boolean. The gateway routes `=approved = true` to the reusable `core-banking-ledger-reversal` Call Activity and `=approved = false` directly to the item end.

The Call Activity explicitly maps `caseId`, `transaction.itemId`, and `transaction.transactionId` into the child process. The ledger worker raises `LEDGER_REVERSAL_FAILED` as a `ZeebeBpmnError` if an item is not approved; the parent catches it with an Error Boundary Event and records the reversal failure. The request-validation and metadata-evaluation business errors also have explicit BPMN Error Boundary Event paths.

## Important runtime prerequisites

Deploy both BPMN files from `bpmn-models/` to the same Camunda 8 cluster. The HTTP JSON Connector must be available to the cluster/runtime, and its network must be able to reach the backend API URL in `TRANSACTION_API_BASE_URL`. Workflow execution is intentionally disabled unless `APP_WORKFLOW_ENABLED=true`.

`P3D` is the production-style timer duration. Set `DEMO_TIMEOUT=PT30S` for a classroom demonstration.
