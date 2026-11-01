/* eslint-disable @typescript-eslint/no-require-imports */
// Example receiver: run behind your own HTTPS reverse proxy. Its database is YOUR
// application database, not Axon's. The accepted action is placed in an outbox;
// the application worker must use event_id as its downstream idempotency key.
const http = require("http");
const crypto = require("crypto");
const { Pool } = require("pg");
const { verifyEnvelope } = require("../backend/n8n/policy.cjs");
const secret = process.env.AXON_CALLBACK_SECRET;
if (!secret || secret.length < 32)
  throw Error("Set the destination signing secret, shown after verification.");
const pool = new Pool({
  connectionString: process.env.RECEIVER_DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
http
  .createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST" || req.url !== "/axon")
      return reply(404, { error: "Not found" });
    try {
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > 16384) return reply(413, { error: "Too large" });
        chunks.push(c);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = JSON.parse(raw);
      if (
        body.type === "axon.destination_verification" &&
        /^[a-f0-9]{64}$/.test(body.challenge || "")
      )
        return reply(200, { challenge: body.challenge });
      const event = verifyEnvelope(raw, req.headers, secret);
      const hash = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            event_id: event.event_id,
            type: event.type,
            agent_id: event.agent_id,
            action_type: event.action_type,
            content: event.content,
          }),
        )
        .digest("hex");
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const inserted = await db.query(
          "INSERT INTO axon_callback_receipts(event_id,payload_hash) VALUES($1,$2) ON CONFLICT(event_id) DO NOTHING RETURNING event_id",
          [event.event_id, hash],
        );
        if (inserted.rows.length) {
          await db.query(
            "INSERT INTO axon_approved_actions(event_id,action) VALUES($1,$2::jsonb)",
            [event.event_id, JSON.stringify(event)],
          );
        } else {
          const old = (
            await db.query(
              "SELECT payload_hash FROM axon_callback_receipts WHERE event_id=$1",
              [event.event_id],
            )
          ).rows[0];
          // Timestamp/signature can change on delivery retry; dedupe by event identity.
          if (!old) throw Error("Receipt unavailable");
          if (old.payload_hash !== hash) {
            await db.query("ROLLBACK");
            return reply(409, { error: "Event identity conflict" });
          }
        }
        await db.query("COMMIT");
        reply(202, { accepted: true, event_id: event.event_id });
      } catch {
        await db.query("ROLLBACK");
        reply(503, { error: "Acceptance unavailable" });
      } finally {
        db.release();
      }
    } catch {
      reply(401, { error: "Invalid callback" });
    }
  })
  .listen(Number(process.env.PORT || 3200), "127.0.0.1");
