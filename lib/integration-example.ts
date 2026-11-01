export const VALIDATION_URL =
  "https://axon-n8n-production-1512.up.railway.app/webhook/validate";
export const integrationExample = `// Run on your server. Keep the API key out of browser code.
const response = await fetch("${VALIDATION_URL}", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.AXON_API_KEY,
    "Content-Type": "application/json",
    "Idempotency-Key": actionId // Stable, 16–80 letters/digits/_/-
  },
  body: JSON.stringify({
    agent_id: "orders-agent",
    action_type: "email_send",
    content: agentOutput,
    mode: "validate_only"
  }),
  signal: AbortSignal.timeout(25000)
});
const result = await response.json();
if (response.ok && result.validated === true && result.status === "PASS") {
  await executeOnce(actionId, agentOutput); // Your durable idempotent executor
} else {
  // Includes PROCESSING, SKIPPED, BLOCK and errors: do not execute.
  await holdForReview(actionId, result);
}`;
