/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const {
  writeTombstone,
  readTombstones,
  assertRecoveryClean,
} = require("../backend/operations/privacy-ledger.cjs");
test("encrypted deletion ledger is idempotent, tenant-bound, tamper-evident and prevents reactivation of old deleted accounts", async () => {
  const cache = path.resolve(".cache");
  fs.mkdirSync(cache, { recursive: true });
  const directory = fs.mkdtempSync(path.join(cache, "ledger-test-")),
    key = crypto.randomBytes(32),
    store = { directory, key };
  const r = {
    version: 1,
    kind: "account-deletion",
    requestId: "123e4567-e89b-12d3-a456-426614174000",
    userId: "user_private_fixture",
    recordedAt: new Date().toISOString(),
  };
  try {
    await writeTombstone(r, store);
    const file = path.join(directory, "privacy-delete-" + r.requestId + ".enc"),
      before = fs.readFileSync(file);
    assert(!before.includes(Buffer.from(r.userId)));
    await writeTombstone({ ...r, recordedAt: new Date().toISOString() }, store);
    assert.deepEqual(fs.readFileSync(file), before);
    await assert.rejects(() =>
      writeTombstone({ ...r, userId: "other" }, store),
    );
    const records = await readTombstones(store);
    assert.equal(records.length, 1);
    await assert.rejects(() =>
      assertRecoveryClean(records, async (ids) => ids.includes(r.userId)),
    );
    assert.equal(
      (await assertRecoveryClean(records, async () => false)).clean,
      true,
    );
    await assert.rejects(() =>
      readTombstones({ directory, key: crypto.randomBytes(32) }),
    );
    const corrupt = Buffer.from(before);
    corrupt[corrupt.length - 1] ^= 1;
    fs.writeFileSync(file, corrupt);
    await assert.rejects(() => readTombstones(store));
  } finally {
    if (!directory.startsWith(cache + path.sep + "ledger-test-"))
      throw Error("Unsafe test cleanup");
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("missing recovery ledger and invalid identities fail closed", async () => {
  await assert.rejects(() =>
    readTombstones({
      directory: path.resolve(".cache/missing-" + crypto.randomUUID()),
      key: crypto.randomBytes(32),
    }),
  );
  await assert.rejects(() =>
    assertRecoveryClean([{ userId: "x" }], async () => false),
  );
});

test("recovery CLI refuses unsafe targets and checks deleted identities using read-only stdin SQL", async () => {
  const vm = require("node:vm"),
    source = fs.readFileSync("scripts/privacy-recovery-check.cjs", "utf8");
  async function run({
    mode = "none",
    ports = {},
    found = false,
    legacy = true,
    db = "axon_restore18_0123456789abcdef",
  } = {}) {
    const calls = [],
      errors = [],
      state = {};
    await vm.runInNewContext(source, {
      process: {
        argv: [
          "node",
          "script",
          db,
          ...(legacy ? ["--legacy-deletions-reviewed"] : []),
        ],
        set exitCode(x) {
          state.exitCode = x;
        },
      },
      console: { log: () => {}, error: (e) => errors.push(e) },
      require: (n) =>
        n === "node:child_process"
          ? {
              execFileSync: (_cmd, args, options) => {
                calls.push({ args, options });
                if (args[0] === "inspect")
                  return JSON.stringify([
                    {
                      State: { Running: true },
                      HostConfig: { NetworkMode: mode, PortBindings: ports },
                      NetworkSettings: { Ports: ports },
                    },
                  ]);
                assert.equal(args[0], "exec");
                assert.equal(args[1], "-i");
                assert.ok(options.input.startsWith("BEGIN READ ONLY;"));
                assert.ok(
                  !/DELETE|UPDATE|INSERT|DROP/i.test(
                    options.input.replace(/\$deleted\$.*?\$deleted\$/g, ""),
                  ),
                );
                assert.ok(!args.join(" ").includes("user_deleted_fixture"));
                return found ? "t" : "f";
              },
            }
          : {
              operatorStore: () => ({}),
              readTombstones: async () => [{ userId: "user_deleted_fixture" }],
              assertRecoveryClean: async (_r, lookup) => {
                if (await lookup(["user_deleted_fixture"]))
                  throw Error("Deleted account restored");
                return { clean: true };
              },
            },
    });
    return { calls, errors, state };
  }
  for (const input of [
    { legacy: false },
    { db: "production" },
    { mode: "bridge" },
    { ports: { "5432/tcp": [] } },
  ]) {
    const r = await run(input);
    assert.equal(r.state.exitCode, 1);
    assert.ok(r.calls.every((c) => c.args[0] === "inspect"));
  }
  assert.equal((await run({ found: true })).state.exitCode, 1);
  assert.equal((await run()).state.exitCode, undefined);
});
