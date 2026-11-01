# BPMN viva notes

`chargeback-process.bpmn` starts at validation and reaches a parallel multi-instance embedded subprocess over `transactions`. Each token has an independent `transaction` variable, so item ID, amount, decision and status do not overwrite each other.

Inside the item flow, metadata is obtained, eligibility is checked, and an embedded **Merchant Representment Window** sends a request and waits for `merchantResponse`. A timer boundary event is attached to that wait and is modelled as `P3D` (three days). For a viva demo, deploy a copied model with `PT30S` rather than changing the production model.

The decision gateway directs approvals into a genuine BPMN **Call Activity**, which invokes `core-banking-ledger-reversal`. That reusable process runs the ledger worker and returns to the parent; rejected items bypass it. `dispute-rules.dmn` is a maintainable eligibility decision-table example.
