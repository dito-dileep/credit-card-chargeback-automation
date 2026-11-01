# Executable Camunda 8 models

Deploy `chargeback-process.bpmn`, `ledger-reversal-process.bpmn`, and `dispute-rules.dmn` to the same Camunda 8 cluster. The main model calls the ledger model by process ID. Its production timer is `P3D`; deploy a copied classroom model with `PT30S` to demonstrate expiry without waiting three days.
