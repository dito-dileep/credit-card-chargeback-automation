# Project presentation and live demonstration

## 60-second introduction

“This is a simulated multi-transaction credit-card chargeback workflow. A customer selects several statement lines and raises one claim. A React portal calls a Spring Boot REST API. Camunda orchestrates independent transaction evaluation, high-value fraud alerts, the merchant response window and deadline, and a reusable ledger reversal for approved items. The data is mock data; this is an academic demonstration, not a live banking system.”

## Live demonstration order

Use the [setup guide](setup-guide.md) to start the full workflow configuration. If Camunda is unavailable, state that you are showing the H2-backed API/UI simulation; do not present it as an engine-run workflow.

1. Open `http://localhost:5173` and introduce the statement and navigation. Show the responsive layout if there is time.
2. Select the Amazon and Flipkart transactions, choose the dispute reasons, and submit one claim. Point out that the UI creates one case with multiple transaction items.
3. Open Tracking. Explain that case status and item results are separately tracked.
4. Open the fraud desk. Flipkart's seeded high amount should demonstrate the configured high-value alert route; the REST API accepts the alert with HTTP `202`.
5. Open Tasklist and accept the Amazon merchant response. Show the approved item and ledger reversal result in Tracking. The `=approved = true` path invokes the child ledger process.
6. Submit or locate a NoReply Electronics item and leave it waiting. For the local workflow profile, the interrupting timer is 30 seconds; show the timeout/rejection outcome after it fires.
7. Open Camunda Operate using the URL printed by C8 Run. Show the process instance, multi-instance children, connector/worker tasks, and the branch history. Capture screenshots only from a real run.
8. Explain the BPMN files: `bpmn-models/chargeback-process.bpmn` is the parent orchestration; `bpmn-models/ledger-reversal-process.bpmn` is the called child process. The REST Connector tasks are BPMN connector elements, not Spring service tasks.

## REST API questions

Show the browser Network panel or run a request in PowerShell:

```powershell
Invoke-RestMethod http://localhost:8080/api/transactions
```

The key responses are `200 OK` for reads, `201 Created` with a case body and `Location` for a new dispute, and `202 Accepted` with a JSON body for the fraud alert and merchant response request. Invalid input returns `400`; workflow actions without a reachable Camunda client return `503`. The exact contracts and sample payloads are in [API documentation](api-documentation.md).

## BPMN explanation for the instructor

- **Multi-instance:** the parent model evaluates submitted transaction lines concurrently because each has independent metadata, eligibility, and merchant outcome; there is no ordering dependency between selected items.
- **Merchant window:** each eligible line waits for a correlated merchant response in a subprocess. Its interrupting boundary timer routes unanswered lines to timeout handling.
- **Gateway conditions:** each exclusive-gateway route uses an explicit FEEL Boolean condition. Explain `=highValue = true/false`, `=eligible = true/false`, and `=approved = true/false`.
- **Call Activity:** only an approved response calls `core-banking-ledger-reversal`; rejection and timeout do not reverse the ledger.
- **REST integration:** the Camunda HTTP JSON Connector fetches transaction metadata and records high-value alerts through the REST API. The Spring API may additionally forward alerts to Slack only when an environment webhook is configured.

The model has parallel multi-instance evaluation. It does not implement a separate sequential multi-instance pass; do not claim that both modes are present.

## Closing

“This prototype demonstrates BPMN orchestration, real HTTP contracts, human-response correlation, timeout and error handling, and per-item financial outcomes using sample data. For production, I would add authentication/authorization, audit controls, idempotency, managed secrets, durable database migrations, deployment hardening, monitoring, and security/compliance review.”
