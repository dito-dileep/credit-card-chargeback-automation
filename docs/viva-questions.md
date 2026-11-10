# Viva questions and answers

1. **Why use a multi-instance subprocess?** A single case can contain multiple statement lines. Parallel iterations evaluate each item independently while retaining a common case ID.
2. **Is transaction metadata retrieved by a REST job worker?** No. It is a Camunda outbound REST Connector task using the official HTTP JSON Connector template and the `/api/transactions/{id}` endpoint. The connector task has its own BPMN template marker/icon.
3. **What does the REST connector do for fraud monitoring?** A condition routes amounts at or above the configured threshold to `POST /api/fraud/alerts`. The endpoint records the alert and reports whether an optional Slack webhook was sent, unconfigured, or failed.
4. **How does the timer work?** An interrupting boundary timer is attached to the merchant response wait. Its duration is configurable; production default is `P3D`, while `PT30S` is useful for a classroom demo. The timeout worker records a rejected item.
5. **How does the user provide a merchant response?** The custom Tasklist lists active waiting items and calls the REST API, which publishes a Camunda message correlated by transaction ID.
6. **Why a Call Activity?** Ledger reversal is a reusable child process. The `=approved = true` route alone calls it; rejected and timed-out routes do not.
7. **How are business errors handled?** Typed workers raise `ZeebeBpmnError` for invalid process input, metadata evaluation failure, or an ineligible reversal. BPMN Error Boundary Events route those errors to explicit status-recording tasks.
8. **How is data protected?** The project uses mock banking data. Database credentials and the optional Slack webhook are supplied through environment variables, not committed to source.
9. **How are duplicates prevented?** API validation rejects repeated transaction IDs in a submission and checks the persisted `disputed` flag before creating a case.
