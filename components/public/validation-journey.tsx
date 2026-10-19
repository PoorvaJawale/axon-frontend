"use client";
import { useState } from "react";
import { ArrowRight, Check, Minus, X } from "lucide-react";

export function ValidationJourney() {
  const [invalid, setInvalid] = useState(false);
  const [run, setRun] = useState(0);
  function select(value: boolean) { setInvalid(value); setRun(n => n + 1); }
  return <section className="ap-journey" aria-labelledby="journey-title">
    <div className="ap-journey-top"><h2 id="journey-title">Before an agent acts.</h2><span className="ap-meta">Interactive example</span></div>
    <p>Choose an output to follow its path through validation.</p>
    <div className="ap-switch" role="group" aria-label="Example output">
      <button type="button" aria-pressed={!invalid} onClick={() => select(false)}>Valid structure</button>
      <button type="button" aria-pressed={invalid} onClick={() => select(true)}>Missing field</button>
    </div>
    <div key={run} className={"ap-route " + (run > 0 ? "ap-route-replay " : "") + (invalid ? "ap-route-block" : "ap-route-pass")}>
      <div className="ap-payload"><span className="ap-meta">Agent output · simplified</span><code>{invalid ? '{ "message": "Hello" }' : '{ "recipient": "user@example.com",\n  "message": "Hello" }'}</code></div>
      <ol className="ap-stages">
        <li><span className="ap-stage-icon">{invalid ? <X size={16}/> : <Check size={16}/>}</span><div><strong>Schema check</strong><span>{invalid ? "Required recipient is missing" : "Required fields are present"}</span></div></li>
        <li className={invalid ? "ap-stage-skipped" : ""}><span className="ap-stage-icon">{invalid ? <Minus size={16}/> : <Check size={16}/>}</span><div><strong>Semantic check</strong><span>{invalid ? "Skipped after schema failure" : "Example content meets the rule"}</span></div></li>
      </ol>
      <div className="ap-decision" role="status" aria-live="polite"><span>{invalid ? "BLOCK" : "PASS"}</span><ArrowRight size={18} aria-hidden="true"/><strong>{invalid ? "Stop before execution" : "Continue to execution"}</strong></div>
    </div>
    <small>Illustrative only. No API call is made and no validations are used.</small>
  </section>;
}
