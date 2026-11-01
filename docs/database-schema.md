# Database schema

`card_transaction` stores mock statement data and disputed flag. `dispute_case` stores the case ID, creation time, status and persisted Camunda process-instance key. `dispute_item` stores one selected transaction, reason, merchant, amount, independent decision/status, merchant response and refund state. JPA generates the schema for development; replace `ddl-auto` with Flyway migrations before production use.
