# Viva questions and answers

1. **Why use multi-instance BPMN?** One customer case can contain several transactions. Parallel multi-instance creates one independent workflow token per line while retaining a common case ID.
2. **How does the timer work?** The boundary event attached to the merchant-response wait cancels that wait when its ISO-8601 duration expires. Production is `P3D`; a demo copy uses `PT30S`.
3. **Why a Call Activity?** The ledger reversal is reusable and separately versioned. Only an approved path calls it; rejected paths cannot refund.
4. **Is the metadata task a REST Connector?** No. It is explicitly a Camunda 8 job worker intended to call a REST API. A native outbound Connector needs the compatible Connector runtime and is not claimed here.
5. **How is data protected?** The implementation uses mock data only, avoids committed secrets, and receives credentials through environment variables.
6. **How are duplicate disputes prevented?** Validation checks the persisted `disputed` flag as well as duplicate IDs within the submitted case.
