# Setup guide

## Requirements

Install Java 21, Maven 3.9+, Node.js 20+, and Git. Docker Desktop is needed only for the PostgreSQL/Compose setup. The Camunda 8 Run option is a separate local developer runtime and does not require Docker, but it is a large download and needs substantial free memory and disk space.

## Quick UI/API simulation (no Camunda or Docker)

From the repository root, start the backend:

```powershell
mvn -f backend-springboot\pom.xml spring-boot:run "-Dspring-boot.run.profiles=local"
```

In a second PowerShell window:

```powershell
Set-Location .\frontend-react
npm ci
npm run dev
```

Open `http://localhost:5173`. The `local` profile uses in-memory H2 and disables Camunda; seeded data is reset when the backend stops. This is the recommended fallback for the UI/API demonstration, not proof of Camunda execution.

## Full local workflow demo with Camunda 8 Run

The repository includes an opt-in Spring profile at `backend-springboot/src/main/resources/application-workflow.yml`. It keeps H2 persistence while enabling the Camunda client and setting the local Camunda REST/gRPC ports and a 30-second merchant timer.

1. Download the Windows developer distribution from the [official Camunda 8 Run documentation](https://docs.camunda.io/docs/self-managed/quickstart/developer-quickstart/c8run/). Extract it to a stable location, for example `C:\camunda\c8run-8.8.46`.
2. Stop any previous app that is using port `8090`, `26500`, or the Connector's configured port. Keep the application API on port `8080`.
3. In PowerShell, start Camunda 8 Run using its included Windows executable and change the default REST port to `8090`:

   ```powershell
   Set-Location C:\camunda\c8run-8.8.46
   .\c8run.exe start --port 8090
   ```

   Keep this window open. Wait until startup completes, then check `http://localhost:8090/v2/topology` returns JSON. The bundled `endpoints.txt` lists the UI addresses and default local credentials; use the actual URLs printed by the runtime.
4. In another PowerShell window, deploy both BPMN resources to the same runtime:

   ```powershell
   $root = "C:\Users\<your-user>\Downloads\03-multi-transaction-credit-card-chargeback-dispute"
   curl.exe -f -X POST http://localhost:8090/v2/deployments `
     -F "resources=@$root\bpmn-models\chargeback-process.bpmn" `
     -F "resources=@$root\bpmn-models\ledger-reversal-process.bpmn"
   ```

   A successful response must include both process definitions (`chargeback-dispute` and `core-banking-ledger-reversal`). If deployment fails, check the response body and Connector task templates before starting the workflow-enabled backend.
5. From the repository root, start the API with both profiles. The profile order matters: `local` configures H2 and the `workflow` profile opts into Camunda.

   ```powershell
   mvn -f backend-springboot\pom.xml spring-boot:run "-Dspring-boot.run.profiles=local,workflow"
   ```

   Wait for Spring Boot and Camunda client startup to complete without connection errors.
6. In a third PowerShell window, start the frontend:

   ```powershell
   Set-Location C:\Users\<your-user>\Downloads\03-multi-transaction-credit-card-chargeback-dispute\frontend-react
   npm ci
   npm run dev
   ```

   Open `http://localhost:5173`; the Vite proxy sends `/api` requests to `http://localhost:8080`.
7. Verify the frontend/API first, then submit a small multi-line claim. Keep the API, frontend, Camunda and Connector runtime running. The Connector must be able to reach the API at `http://localhost:8080`; local development uses that base URL.
8. Use the frontend's Tasklist to accept or contest a waiting eligible item. To show the timeout branch, leave an item unanswered for at least 30 seconds. Inspect the running process and incidents in Operate; screenshots and runtime logs are evidence only if captured from this actual run.

If the Camunda distribution's start script or URL differs, follow the version-specific instructions in its included README. Do not mark the workflow as working solely because the API and UI start: deployment, a created process instance, connector results, and the intended branch outcomes must be observed.

## PostgreSQL / Docker Compose

For the PostgreSQL deployment, install Docker Desktop, copy `.env.example` to `.env`, set a private local database password, and run:

```powershell
docker compose up --build
```

Open the frontend at `http://localhost:5173`; the API listens on port `8080`. The Compose stack does not bundle a Camunda cluster. Workflow mode remains disabled unless an external Camunda cluster and Connector runtime are configured.

## Important configuration

The REST Connector template uses `io.camunda.connectors.HttpJson.v2` version 11. Verify compatibility before upgrading Camunda/Connector dependencies. The normal merchant response window is `P3D`; the opt-in local workflow profile uses `PT30S`. Configure `SLACK_WEBHOOK_URL` only in a local environment if you want to test webhook forwarding; never commit the secret.

## Stop and restart after reboot

Close each foreground terminal with `Ctrl+C` (Camunda Run, API, and Vite). After reboot, open three PowerShell windows and repeat steps 3, 5, and 6 above; do not rerun `npm ci` unless dependencies changed or `node_modules` is absent. Camunda Run's local state is tied to its extracted runtime directory and is not the same as production persistence. The H2 application data is in memory and resets on each backend restart.
