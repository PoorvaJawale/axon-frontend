// Read-only cloud build check. Provider secrets stay in their deployment env.
async function main() {
  const key = process.env.RAZORPAY_KEY_ID,
    secret = process.env.RAZORPAY_KEY_SECRET,
    id = process.env.RAZORPAY_PLAN_ID;
  if (!key && !secret && !id && process.env.VERCEL_ENV !== "production") {
    console.log(
      "Provider preflight skipped: no payment configuration in this build.",
    );
    return;
  }
  if (!key || !secret || !id || !/^plan_[a-zA-Z0-9]+$/.test(id))
    throw Error("PAYMENT_CONFIGURATION_INCOMPLETE");
  const mode = key.startsWith("rzp_live_")
    ? "live"
    : key.startsWith("rzp_test_")
      ? "test"
      : "unknown";
  if (process.env.VERCEL_ENV === "production" && mode !== "live")
    throw Error("PRODUCTION_PAYMENTS_REQUIRE_LIVE_MODE");
  const response = await fetch(
    "https://api.razorpay.com/v1/plans/" + encodeURIComponent(id),
    {
      headers: {
        Authorization:
          "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw Error("PAYMENT_PLAN_LOOKUP_FAILED");
  let text = "",
    size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 16384) throw Error("PAYMENT_PLAN_RESPONSE_TOO_LARGE");
    text += Buffer.from(chunk).toString("utf8");
  }
  const plan = JSON.parse(text),
    summary = {
      provider: "Razorpay",
      mode,
      period: plan.period,
      interval: plan.interval,
      currency: plan.item?.currency,
      amountPaise: plan.item?.amount,
      readOnly: true,
    };
  console.log("Provider configuration: " + JSON.stringify(summary));
  if (
    mode === "unknown" ||
    plan.period !== "monthly" ||
    plan.interval !== 1 ||
    plan.item?.currency !== "INR" ||
    plan.item?.amount !== 79900
  )
    throw Error("PAYMENT_PLAN_MUST_BE_MONTHLY_INR_79900");
}
main().catch((e) => {
  console.error("Provider preflight failed:", e.message);
  process.exitCode = 1;
});
