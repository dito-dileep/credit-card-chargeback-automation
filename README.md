# Multi-Transaction Credit Card Chargeback Dispute Automation

<<<<<<< HEAD
<p align="center">
  <img src="frontend-react/src/assets/chargeback-hero.png" alt="Chargeback dashboard visual" width="100%" />
</p>

<p align="center"><strong>A premium Camunda 8 workflow demonstration for secure, multi-line credit-card disputes.</strong></p>
=======
**Domain:** Banking & Financial Services  
**Source idea number:** 3  
**Team size:** 2 students

## Team members
- Student 1:DITO DILEEP (RA2411026010050)
- Student 2:ADITHYA R NATH (RA2411026010003)
>>>>>>> origin/main

A customer selects multiple statement lines, supplies a reason, and creates one secure case while Camunda 8 evaluates each transaction independently. The system is intentionally built with mock banking data only.

## Team

| Member | Responsibilities |
|---|---|
| DITO DILEEP (RA2411026010050) | BPMN architecture, Camunda integration, workflow deployment, major project implementation |
| ADITHYA R NATH (RA2411026010003) | Spring Boot APIs, React interface, REST integration and testing |

Both team members participate in integration, testing, documentation, and the final demonstration.

## What it demonstrates

- React/Vite banking dashboard: statement selection, combined submission, tracking, refunds, and fraud monitoring.
- Spring Boot REST API with PostgreSQL persistence and seeded mock transactions.
- Camunda 8 executable BPMN: a **parallel multi-instance** transaction subprocess, merchant representment embedded subprocess, three-day boundary timer, gateways, and genuine Call Activity.
- A separate `core-banking-ledger-reversal` process invoked only for approved items.
- REST-style metadata worker and configurable high-value alert worker. The metadata task is a Java Camunda job worker, not falsely described as a native Connector.

## Architecture

`React → Spring REST API → PostgreSQL` and `Spring Camunda workers ↔ Camunda 8 → BPMN call activity → ledger reversal`.

See [architecture](docs/architecture.md), [API reference](docs/api-documentation.md), and [BPMN explanation](docs/bpmn-workflow-explanation.md).

## Run

1. Copy `.env.example` to `.env` and replace the database password.
2. Start PostgreSQL and the application stack: `docker compose up --build`.
3. Browse `http://localhost:5173`; API runs on port 8080.
4. For executable workflows, start Camunda's official local Docker Compose distribution separately, deploy the files in `bpmn-models/`, and set `CAMUNDA_CLIENT_ZEEBE_GRPC_ADDRESS` to its endpoint.

For development without Docker: run PostgreSQL, `cd backend-springboot && mvn spring-boot:run`, then `cd frontend-react && npm install && npm run dev`. Set `APP_WORKFLOW_ENABLED=true` only when a Camunda 8 cluster is reachable.

## Tests

`cd backend-springboot && mvn test` runs service validation tests against H2. `cd frontend-react && npm install && npm run build` validates the frontend bundle. Manual workflow tests are listed in [testing guide](docs/testing-guide.md).

## Seeded evidence

Amazon (₹2,000) represents an approval route; Subscription Streaming (₹499) is rejected; NoReply Electronics (₹1,200) represents merchant non-response; Flipkart (₹5,000) triggers the high-value alert. An unknown ID proves invalid-input handling.

## Limitations

This is a mock banking system: no real card data, payment rail, Slack credential, or native Camunda REST Outbound Connector is included. The production BPMN deadline is `P3D`; deploy a copied model with `PT30S` for a 30-second classroom demo. Assignment PDF/allocation-sheet files were not supplied in this workspace, so allocation could not be independently verified.
