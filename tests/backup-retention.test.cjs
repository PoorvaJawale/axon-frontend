/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { planRetention } = require("../backend/operations/backup-retention.cjs");
const now = Date.parse("2026-11-02T00:00:00Z"),
  day = 86400000;
function entries() {
  return ["appdb", "n8ndb", "n8nkey"].flatMap((target) =>
    [0, 1, 2, 31, 40].map((age) => ({
      target,
      encryptedFile: target + "-" + age,
      createdAt: new Date(now - age * day).toISOString(),
      authenticated: true,
      restored: age === 40,
    })),
  );
}
test("retention expires old copies but keeps three recent points and last verified restore per target", () => {
  const p = planRetention(entries(), now);
  assert.equal(p.remove.length, 3);
  assert(p.remove.every((e) => e.encryptedFile.endsWith("-31")));
  assert.equal(p.keep.length, 12);
});
test("retention refuses deletion if any target lacks three copies or a fresh authenticated backup", () => {
  assert.throws(() =>
    planRetention(
      entries().filter((e) => e.target !== "n8nkey"),
      now,
    ),
  );
  assert.throws(() =>
    planRetention(
      entries().filter(
        (e) =>
          !e.encryptedFile.endsWith("-0") && !e.encryptedFile.endsWith("-1"),
      ),
      now,
    ),
  );
});
test("retention never counts unverified or future-dated copies as a safe replacement", () => {
  const e = entries();
  for (const x of e) if (x.target === "appdb") x.authenticated = false;
  assert.throws(() => planRetention(e, now));
  const f = entries();
  f[0].createdAt = new Date(now + day).toISOString();
  assert.throws(() => planRetention(f, now));
});
