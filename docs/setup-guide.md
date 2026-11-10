# Setup guide

Install Java 21, Maven 3.9+, Node 20+, and Docker Desktop. Copy `.env.example` to `.env`, set a local database password, and start the application stack with `docker compose up --build`. Open the frontend at `http://localhost:5173`; the API listens on port 8080.

The application stack does not include Camunda 8. Workflow mode is disabled by default. For executable workflows, deploy both BPMN files from `bpmn-models/` to a reachable Camunda 8 cluster, configure the REST and Zeebe gRPC addresses, and make the HTTP JSON Connector runtime available. Set `APP_WORKFLOW_ENABLED=true` only after confirming that the backend can reach the cluster. The Connector runtime must be able to reach the address configured in `TRANSACTION_API_BASE_URL`.

The REST Connector template in the BPMN uses version 11 of `io.camunda.connectors.HttpJson.v2`, which supports Camunda 8.3 and later. Verify the runtime/Connector version matrix before upgrading dependencies. Set `DEMO_TIMEOUT=PT30S` for a short demonstration; the default response window is `P3D`. Configure `SLACK_WEBHOOK_URL` in the backend environment to forward high-value fraud alerts; it is optional and is never committed.

For development without Docker, start PostgreSQL, run `mvn spring-boot:run` from `backend-springboot`, and run `npm ci && npm run dev` from `frontend-react`. Set `TRANSACTION_API_BASE_URL=http://localhost:8080` when the Connector runtime runs on the host.
