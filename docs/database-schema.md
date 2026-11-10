# Database schema

`card_transaction` stores mock statement data, including the seeded `eligible_for_dispute` business decision and the `disputed` flag. `dispute_case` stores the customer, creation time, case status, and Camunda process-instance key. `dispute_item` stores one selected transaction, reason, merchant, amount, independent decision/status, merchant response, refund status, and fraud-alert delivery status.

The backend uses PostgreSQL in Compose and H2 for tests. JPA generates the schema for this demonstration; replace `ddl-auto` with versioned Flyway migrations before production use.
