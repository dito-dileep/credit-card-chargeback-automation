# Test and demonstration checklist

1. Submit Amazon alone: expected pending case and, with Camunda deployed and merchant response correlated, approved/refunded result.
2. Submit Amazon + Flipkart: two multi-instance tokens; Flipkart produces a fraud alert.
3. Submit Subscription Streaming: rejected route, no Call Activity/refund.
4. Submit NoReply Electronics and do not correlate a message: timer boundary route after deadline.
5. POST an unknown transaction: HTTP 400.
6. POST an already selected transaction again: HTTP 400.

Automated backend tests cover multi-line creation and missing-reason validation. They do not start a Camunda cluster. Deploy BPMN with Modeler/your Camunda 8 cluster and inspect Operate to verify the multi-instance and Call Activity paths.
