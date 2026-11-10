# Executable Camunda 8 models

Deploy `chargeback-process.bpmn` and `ledger-reversal-process.bpmn` to the same Camunda 8 cluster. The parent calls the child process by ID `core-banking-ledger-reversal`.

The REST Connector tasks use template `io.camunda.connectors.HttpJson.v2` version 11 and task type `io.camunda:http-json:1`. Ensure the Connector runtime is installed and can reach `TRANSACTION_API_BASE_URL`. The parent model uses explicit FEEL conditions on every outgoing decision flow, a parallel multi-instance subprocess, a merchant response timer, and BPMN error boundaries for business errors.

The default timer is `P3D`; set `DEMO_TIMEOUT=PT30S` for a short classroom demonstration.
