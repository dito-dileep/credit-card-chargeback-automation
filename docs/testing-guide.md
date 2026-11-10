# Test and demonstration checklist

## API and UI

1. List transactions and confirm the ineligible Subscription Streaming line cannot be disputed by the workflow.
2. Select Amazon and Flipkart together and submit them as one case.
3. Submit an unknown transaction ID, unsupported reason, duplicate line, and already-disputed line; each request must return HTTP 400 with an `error` field.
4. Open Tracking and confirm the API refreshes case/item state while the workflow runs.
5. Open Tasklist and correlate an accepted or contested merchant response while an item is waiting.

## Camunda 8

1. Start a case containing Amazon and Flipkart. Verify two independent parallel multi-instance tokens.
2. Confirm Flipkart takes the `=highValue = true` route and the REST Connector records a fraud alert. Confirm the Slack status is `NOT_CONFIGURED` unless a webhook is supplied.
3. Accept the Amazon merchant response. Verify only the `=approved = true` route invokes `core-banking-ledger-reversal` and the item becomes `REFUNDED`.
4. Contest a merchant response and verify the `=approved = false` route does not invoke the ledger process.
5. Submit Subscription Streaming and verify `=eligible = false` records a rejection without a refund.
6. Leave NoReply Electronics unanswered and verify the timer boundary worker records `TIMEOUT` and a rejection.
7. Exercise BPMN errors for invalid workflow input, metadata evaluation, and ledger reversal; inspect their boundary-event paths in Operate.
8. Capture genuine screenshots and logs from the running app and Camunda Operate for the submission report. Do not treat the automated unit tests as engine execution evidence.

## Automated checks

`mvn test` in `backend-springboot` starts the Spring Boot API on a random local port with H2 and makes real HTTP requests. It verifies transaction metadata `200 OK` with JSON, case creation `201 Created` with a `Location` and JSON body, fraud alert `202 Accepted` with a JSON result, persistence of the alert status, and invalid alert input `400 Bad Request` with an error body. The other backend tests cover service validation.

`npm run build` in `frontend-react` checks the production UI bundle. The automated checks do not start a Camunda cluster or outbound Connector runtime, so process deployment, connector execution, and Operate evidence still require a configured Camunda environment.
