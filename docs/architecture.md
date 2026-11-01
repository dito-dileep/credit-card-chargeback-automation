# Architecture

The React client calls the Spring API. The API validates ownership, reason, uniqueness, and prior disputes; stores a case and line items in PostgreSQL; then starts `chargeback-dispute` when `APP_WORKFLOW_ENABLED=true`. The returned Camunda process instance key is persisted on the case.

Camunda dispatches service-task jobs to `WorkflowWorkers`. Metadata retrieval is represented by the `fetch-transaction-metadata` worker; in production it calls the bank transaction API. Jobs make individual decisions and only the BPMN Call Activity launches the ledger-reversal process. This prevents a rejected item being refunded merely through a database update.
