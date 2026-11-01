"use client";
import { useState } from "react";
import useSWR from "swr";
import { dashboardFetcher } from "@/lib/dashboard";
import { CopyButton } from "@/components/dashboard/ui";
export function CallbackSettings() {
  const { data, error, mutate } = useSWR(
    "/webhook/callbacks",
    dashboardFetcher,
  );
  const [url, setUrl] = useState("");
  const [challenge, setChallenge] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(action: string, target = url) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/webhook/callbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, url: target, challenge }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Could not save destination");
      if (b.challenge) {
        setChallenge(b.challenge);
        setSecret("");
        setMessage(b.instructions);
      }
      if (b.signingSecret) {
        setSecret(b.signingSecret);
        setChallenge("");
        setMessage(
          "Destination verified. Save this signing secret; it is shown once.",
        );
      }
      await mutate();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not update destination.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="dash-panel dash-summary dash-account-settings">
      <summary>Verified dispatch destinations</summary>
      <p>
        Optional. Validate-only requests do not need a destination. Use a public
        HTTPS endpoint and verify ownership before Axon can deliver approved
        actions.
      </p>
      {error && (
        <p role="alert">
          Destinations unavailable.{" "}
          <button className="dash-button" onClick={() => void mutate()}>
            Try again
          </button>
        </p>
      )}
      <ul>
        {data?.destinations?.map(
          (d: { url: string; verified_at: string | null }) => (
            <li key={d.url} className="dash-actions">
              <code className="dash-truncate">{d.url}</code>
              <span>{d.verified_at ? "Verified" : "Pending verification"}</span>
              <button
                className="dash-button"
                disabled={busy}
                onClick={() => void act("delete", d.url)}
              >
                Remove
              </button>
            </li>
          ),
        )}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act("register");
        }}
      >
        <label htmlFor="callback-url">HTTPS destination</label>
        <input
          className="dash-input"
          id="callback-url"
          type="url"
          required
          maxLength={2048}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setChallenge("");
            setSecret("");
          }}
          placeholder="https://your-app.com/axon"
        />
        <button className="dash-button" disabled={busy}>
          Register destination
        </button>
      </form>
      {challenge && (
        <>
          <p>
            Your endpoint must return this challenge in JSON when Axon sends a
            verification POST:
          </p>
          <pre className="dash-code">{JSON.stringify({ challenge })}</pre>
          <button
            className="dash-button dash-button-primary"
            disabled={busy}
            onClick={() => void act("verify")}
          >
            Verify destination
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {secret && (
        <>
          <pre className="dash-code dash-secret">{secret}</pre>
          <CopyButton text={secret} label="Copy signing secret" />
          <button className="dash-button" onClick={() => setSecret("")}>
            I saved it
          </button>
        </>
      )}
    </details>
  );
}
export function PrivacySettings() {
  const { data, mutate } = useSWR("/webhook/privacy", dashboardFetcher);
  const [kind, setKind] = useState("export");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <details className="dash-panel dash-summary dash-account-settings">
      <summary>Account data requests</summary>
      <p>
        Request an export or account deletion for support review. Cancel
        subscription renewal separately in Billing. This form records a request;
        it does not immediately delete data.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/webhook/privacy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, confirmed }),
            });
            const b = await r.json();
            if (!r.ok) throw Error(b.error || "Request unavailable");
            setMessage(b.message);
            setConfirmed(false);
            await mutate();
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Could not save your request.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="privacy-kind">Request type</label>
        <select
          className="dash-input"
          id="privacy-kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setConfirmed(false);
          }}
        >
          <option value="export">Export my account data</option>
          <option value="delete">Delete my account</option>
        </select>
        <label className="dash-actions">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            required
          />
          I confirm this request for my account.
        </label>
        <button className="dash-button" disabled={!confirmed || busy}>
          {busy ? "Saving request…" : "Submit data request"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <ul>
        {data?.requests?.map(
          (r: { id: string; kind: string; state: string }) => (
            <li key={r.id}>
              {r.kind}: {r.state}
            </li>
          ),
        )}
      </ul>
    </details>
  );
}
