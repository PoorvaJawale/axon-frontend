/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const folder = path.resolve("backend/workflows");
const manifest = JSON.parse(
  fs.readFileSync(path.join(folder, "manifest.json")),
);
for (const item of manifest) {
  const bytes = fs
    .readFileSync(path.join(folder, item.file), "utf8")
    .replace(/\r\n/g, "\n");
  if (crypto.createHash("sha256").update(bytes).digest("hex") !== item.sha256)
    throw Error("Workflow changed: " + item.file);
  const w = JSON.parse(bytes);
  if (w.active || w.pinData) throw Error("Unsafe workflow export");
  const names = new Set(w.nodes.map((n) => n.name));
  for (const n of w.nodes) {
    if (n.credentials) throw Error("Credentials included");
    if (n.type === "n8n-nodes-base.code")
      new (Object.getPrototypeOf(async function () {}).constructor)(
        n.parameters.jsCode,
      );
  }
  for (const [from, c] of Object.entries(w.connections)) {
    if (!names.has(from)) throw Error("Missing source " + from);
    for (const outputs of Object.values(c))
      for (const edges of outputs)
        for (const edge of edges)
          if (!names.has(edge.node)) throw Error("Missing target " + edge.node);
  }
}
console.log(
  "Verified " +
    manifest.length +
    " inactive exports: hashes, JavaScript syntax, connections and no credential bindings. n8n staging import still required.",
);
