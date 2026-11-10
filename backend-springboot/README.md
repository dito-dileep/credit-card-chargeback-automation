# Spring Boot backend

Java 21 / Spring Boot REST API, PostgreSQL persistence, and typed Camunda 8 job workers. `GET /api/transactions/{id}` provides metadata to the BPMN REST Connector; `POST /api/fraud/alerts` records high-value alerts and optionally relays them through `SLACK_WEBHOOK_URL`.

Run `mvn test` then `mvn spring-boot:run`. Set `APP_WORKFLOW_ENABLED=true` only when a reachable Camunda 8 cluster and HTTP JSON Connector runtime are configured. See the [API reference](../docs/api-documentation.md) and [setup guide](../docs/setup-guide.md).
