/* eslint-disable @typescript-eslint/no-require-imports -- Operator-only metadata migration. */
const { createClerkClient } = require("@clerk/backend");
async function main() {
  const args = process.argv.slice(2),
    apply = args.includes("--apply");
  if (apply && !args.includes("--control-deploy-verified"))
    throw Error(
      "Verify the new session-authorized control deployment before removing legacy key metadata.",
    );
  if (!process.env.CLERK_SECRET_KEY)
    throw Error("Clerk operator configuration is required.");
  const i = args.indexOf("--offset"),
    offset = i < 0 ? 0 : Number(args[i + 1]);
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw Error("Invalid offset.");
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const page = await clerk.users.getUserList({ limit: 100, offset });
  let found = 0;
  for (const user of page.data) {
    if (
      typeof user.privateMetadata?.axonApiKey === "string" &&
      user.privateMetadata.axonApiKey
    ) {
      found++;
      if (apply)
        await clerk.users.updateUserMetadata(user.id, {
          privateMetadata: { axonApiKey: null },
        });
    }
  }
  console.log(
    JSON.stringify({
      mode: apply ? "applied" : "dry-run",
      accountsScanned: page.data.length,
      legacyKeyRecords: found,
      nextOffset: offset + page.data.length,
      more: offset + page.data.length < page.totalCount,
    }),
  );
}
main().catch((e) => {
  console.error(
    e.status
      ? "Clerk migration needs retry (HTTP " + e.status + ")."
      : e.message,
  );
  process.exitCode = 1;
});
