# Multi-Transaction Credit Card Chargeback Dispute Automation

**Domain:** Banking and Financial Services

**Project idea:** 3, inspired by Capital One
**Team:** DITO DILEEP (RA2411026010050) and ADITHYA R NATH (RA2411026010003)

A customer selects multiple statement lines in a React application and submits one dispute case. Spring Boot validates and persists the case, then starts a Camunda 8 process. A parallel multi-instance subprocess evaluates each line independently, retrieves transaction metadata through the Camunda REST Connector, checks eligibility, opens a merchant-response window, and calls a reusable ledger-reversal process only for approved items.

All records and reversals are mock data. Do not use real cardholder or payment information.

## Technology

- React and Vite frontend.
- Java 21 and Spring Boot REST API.
- PostgreSQL for application persistence; H2 for automated tests.
- Camunda 8 Zeebe, BPMN 2.0, FEEL, and the outbound REST Connector.
- Dockerfiles and Docker Compose for the application and database.

## Core capabilities

| Capability | Implementation |
|---|---|
| Multi-transaction claims | Submit several statement lines in one dispute case. |
| Parallel evaluation | Process each line independently with a BPMN multi-instance subprocess. |
| Merchant representment | Wait for a correlated merchant response, with an interrupting three-day timer. |
| Ledger reversal | Invoke the reusable child process only for approved items. |
| Transaction metadata | Use the native Camunda HTTP JSON REST Connector (`R` marker), not an ordinary worker task. |
| Fraud monitoring | Alert on high-value items through a second REST Connector task. |
| Case tracking | Display item decisions and pending merchant actions in the React dashboard and Tasklist. |

## Architecture

`React → Spring Boot REST API → PostgreSQL`

`Spring Boot → Camunda 8 → parallel transaction subprocess → REST metadata/fraud APIs → merchant response → ledger-reversal Call Activity`

The React Tasklist displays items waiting for merchant responses and sends them to the backend for message correlation. Case status and item decisions are persisted and refreshed by the dashboard.

## BPMN decisions and FEEL expressions

| Decision or mapping | FEEL expression | Outcome |
|---|---|---|
| Parallel item collection | `=transactions` | One isolated iteration for each disputed line |
| High-value route | `=highValue = true` | Send a fraud alert through the REST Connector |
| Non-high-value route | `=highValue = false` | Continue directly to eligibility |
| Eligible route | `=eligible = true` | Wait for merchant response |
| Ineligible route | `=eligible = false` | Mark the item rejected; do not call the ledger process |
| Approved route | `=approved = true` | Invoke `core-banking-ledger-reversal` |
| Rejected or timed-out route | `=approved = false` | End the item without a refund |
| Metadata URL | `=transactionApiBaseUrl + "/api/transactions/" + transaction.transactionId` | Fetch the selected transaction from the Spring REST API |
| Merchant timer | `=duration(merchantTimeout)` | Expire the response wait after the configured ISO-8601 duration |
| Ledger call inputs | `=caseId`, `=transaction.itemId`, `=transaction.transactionId` | Explicitly scope identifiers into the child process |

Every outgoing flow from a decision gateway has a boolean condition. Invalid requests, metadata evaluation errors, and ledger reversal business errors have BPMN error paths. The merchant response wait has an interrupting timer boundary event.

The REST tasks use the official Camunda REST Connector template (`io.camunda.connectors.HttpJson.v2`, version 11) and worker type `io.camunda:http-json:1`. The modeler template adds the connector marker/icon; these are outbound REST Connector tasks, not ordinary application job workers. The backend fraud endpoint records each qualifying alert and optionally forwards it to Slack when `SLACK_WEBHOOK_URL` is configured.

## Run with Docker

1. Copy `.env.example` to `.env` and set a local PostgreSQL password.
2. Start the application and database with `docker compose up --build`.
3. Open `http://localhost:5173`; the Spring API is available at `http://localhost:8080`.
4. Workflow execution is disabled by default. To enable it, deploy both BPMN files from `bpmn-models/` to a reachable Camunda 8 cluster, configure the Camunda REST and Zeebe gRPC addresses, and run a compatible Connector runtime that includes the HTTP JSON Connector. Then set `APP_WORKFLOW_ENABLED=true`.
5. In Docker Compose, the connector runtime must be able to reach the backend at `http://backend:8080`. Set `TRANSACTION_API_BASE_URL` to the backend address visible from that runtime.
6. To use Slack alerts, set `SLACK_WEBHOOK_URL`; no webhook or other credential is committed to this repository.

For local development, start PostgreSQL, run `mvn spring-boot:run` from `backend-springboot`, and run `npm ci && npm run dev` from `frontend-react`. Set `TRANSACTION_API_BASE_URL=http://localhost:8080` for a Connector runtime running on the host. Set `DEMO_TIMEOUT=PT30S` for a short classroom timer; the default is `P3D`.

## REST API

The full endpoint catalog, example payloads, and response fields are in [the API reference](docs/api-documentation.md).

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/transactions` | List statement lines |
| GET | `/api/transactions/{id}` | Return transaction metadata for the BPMN REST Connector |
| POST | `/api/disputes` | Create one dispute from multiple transaction lines |
| GET | `/api/disputes` | List cases and item decisions |
| GET | `/api/disputes/{id}` | Retrieve a case |
| GET | `/api/disputes/{id}/transactions` | Retrieve item-level workflow results |
| GET | `/api/tasklist` | List items awaiting merchant responses |
| POST | `/api/disputes/{caseId}/transactions/{itemId}/merchant-response` | Correlate a merchant decision to the process |
| POST | `/api/fraud/alerts` | Persist a high-value alert and optionally forward it to Slack |
| GET | `/api/refunds/{itemId}` | Retrieve an item refund result |
| GET | `/api/dashboard/summary` | Return dashboard counts |

## Demonstration data

The backend seeds simulated transactions to demonstrate the principal paths:

| Transaction | Amount | Scenario |
|---|---:|---|
| Amazon India | ₹2,000 | Eligible dispute, below high-value threshold |
| Subscription Streaming | ₹499 | Ineligible transaction |
| NoReply Electronics | ₹1,200 | Merchant response timeout |
| Flipkart | ₹5,000 | High-value fraud alert |

These are mock records; the project does not process real cardholder or payment data.

## Team

| Member | Student ID | Focus |
|---|---|---|
| Dito Dileep | RA2411026010050 | BPMN architecture, Camunda integration, deployment, and implementation |
| Adithya R Nath | RA2411026010003 | Spring Boot APIs, React interface, REST integration, and testing |

## Verification

- Backend: `mvn test` from `backend-springboot`.
- Frontend: `npm ci && npm run build` from `frontend-react`.
- Workflow scenarios and BPMN checks: [testing guide](docs/testing-guide.md).
- Setup details: [setup guide](docs/setup-guide.md).

The automated tests do not start a Camunda cluster. Confirm model deployment and successful executions in Camunda Operate before presenting engine-run evidence.

## Project documentation

- [Architecture](docs/architecture.md)
- [BPMN workflow explanation](docs/bpmn-workflow-explanation.md)
- [Database schema](docs/database-schema.md)
- [Testing guide](docs/testing-guide.md)
- [Viva questions](docs/viva-questions.md)

The attached submission guidelines also prescribe a separate approximately 20-page technical report and actual application/Operate screenshots. Those screenshots and execution logs must be captured from a running Camunda environment; this repository does not fabricate that evidence.
