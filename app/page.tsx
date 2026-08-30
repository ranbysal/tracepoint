"use client";

import { useMemo, useState } from "react";
import { diagnose, escalationPacket } from "../lib/diagnostics";
import { getScenario } from "../lib/scenarios";
import type { Diagnosis, Telemetry } from "../lib/types";

type IncidentResult = {
  telemetry: Telemetry;
  diagnosis: Diagnosis;
  escalation: ReturnType<typeof escalationPacket>;
};

const scenarioButtons = [
  ["bad_request", "400 Validation"],
  ["auth", "401 Auth"],
  ["permission", "403 Permission"],
  ["rate_limit", "429 Rate Limit"],
  ["server", "500 Server"],
  ["timeout", "Timeout"]
] as const;

function makeResult(t: Telemetry): IncidentResult {
  const d = diagnose(t);
  return { telemetry: t, diagnosis: d, escalation: escalationPacket(t, d) };
}

export default function Home() {
  const initial = useMemo(() => getScenario("rate_limit"), []);
  const [result, setResult] = useState<IncidentResult | null>(initial ? makeResult(initial) : null);
  const [loading, setLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  function loadScenario(key: string) {
    const t = getScenario(key);
    if (t) setResult(makeResult(t));
    setLiveError(null);
  }

  async function runLiveProbe() {
    setLoading(true);
    setLiveError(null);
    try {
      const res = await fetch("/api/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "Return exactly: tracepoint probe ok", timeoutMs: 15000 })
      });
      const data = await res.json();
      if (!data.telemetry) throw new Error(data.error || `Probe failed with HTTP ${res.status}`);
      setResult(data);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "Live probe failed");
    } finally {
      setLoading(false);
    }
  }

  const t = result?.telemetry;
  const d = result?.diagnosis;

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="pulse" /> TRACEPOINT</div>
        <div className="meta">AI SUPPORT INCIDENT CONSOLE / v0.1</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">SUPPORT ENGINEERING LAB</p>
          <h1>Reproduce. Diagnose. Escalate.</h1>
          <p className="lede">A portfolio incident console for OpenAI API support. It captures the evidence an engineer actually needs: HTTP status, request IDs, timestamps, model scope, latency, reproduction context, and a structured escalation packet.</p>
        </div>
        <div className="heroStat">
          <span>ACTIVE CASE</span>
          <strong>{d?.severity || "-"}</strong>
          <small>{d?.category || "No incident loaded"}</small>
        </div>
      </section>

      <section className="controls panel">
        <div>
          <p className="label">SYNTHETIC INCIDENTS</p>
          <div className="buttonRow">
            {scenarioButtons.map(([key, label]) => <button key={key} onClick={() => loadScenario(key)}>{label}</button>)}
          </div>
        </div>
        <div className="liveBox">
          <div>
            <p className="label">LIVE OPENAI PROBE</p>
            <p className="muted">Uses your server-side OPENAI_API_KEY and the Responses API.</p>
          </div>
          <button className="primary" onClick={runLiveProbe} disabled={loading}>{loading ? "Running..." : "Run probe"}</button>
        </div>
        {liveError && <div className="alert">{liveError}</div>}
      </section>

      {result && t && d && (
        <>
          <section className="metricGrid">
            <div className="metric"><span>STATUS</span><strong>{t.status ?? "TIMEOUT"}</strong></div>
            <div className="metric"><span>LATENCY</span><strong>{t.latencyMs} ms</strong></div>
            <div className="metric"><span>SOURCE</span><strong>{t.source.toUpperCase()}</strong></div>
            <div className="metric"><span>ATTEMPTS</span><strong>{t.attempts}</strong></div>
          </section>

          <section className="grid2">
            <article className="panel">
              <p className="label">INCIDENT TELEMETRY</p>
              <dl className="telemetry">
                <div><dt>Timestamp</dt><dd>{t.timestamp}</dd></div>
                <div><dt>Model</dt><dd>{t.model || "n/a"}</dd></div>
                <div><dt>x-request-id</dt><dd>{t.requestId || "not returned"}</dd></div>
                <div><dt>x-client-request-id</dt><dd>{t.clientRequestId || "n/a"}</dd></div>
                <div><dt>Error</dt><dd>{t.message}</dd></div>
              </dl>
            </article>

            <article className="panel diagnosis">
              <p className="label">DIAGNOSIS</p>
              <h2>{d.category}</h2>
              <p>{d.likelyCause}</p>
              <div className={`badge ${d.escalationNeeded ? "warn" : "ok"}`}>{d.escalationNeeded ? "ENGINEERING ESCALATION" : "SUPPORT-SIDE ISOLATION"}</div>
            </article>
          </section>

          <section className="grid2">
            <article className="panel">
              <p className="label">NEXT CHECKS</p>
              <ol className="checks">{d.nextChecks.map((x, i) => <li key={i}>{x}</li>)}</ol>
            </article>
            <article className="panel">
              <p className="label">CUSTOMER UPDATE</p>
              <blockquote>{d.customerMessage}</blockquote>
              <p className="label space">ESCALATION LOGIC</p>
              <p className="muted">{d.escalationReason}</p>
            </article>
          </section>

          <section className="panel packet">
            <div className="packetHeader">
              <div>
                <p className="label">ENGINEERING-READY ESCALATION PACKET</p>
                <h2>{result.escalation.title}</h2>
              </div>
              <span className="mono">JSON / COPYABLE</span>
            </div>
            <pre>{JSON.stringify(result.escalation, null, 2)}</pre>
          </section>
        </>
      )}

      <footer>
        <span>Built to demonstrate API troubleshooting, evidence collection, incident communication, and support automation.</span>
        <span>Next.js / TypeScript / Python / OpenAI Responses API</span>
      </footer>
    </main>
  );
}
