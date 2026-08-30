import { NextRequest, NextResponse } from "next/server";
import { diagnose, escalationPacket } from "../../../lib/diagnostics";
import type { IncidentKind, Telemetry } from "../../../lib/types";

export const runtime = "nodejs";

function classify(status: number | null): IncidentKind {
  if (status === null) return "timeout";
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  if (status >= 400) return "bad_request";
  return "success";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const input = typeof body.input === "string" && body.input.trim()
    ? body.input.trim()
    : "Return exactly: tracepoint probe ok";
  const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 15000, 1000), 60000);
  const clientRequestId = `tp_${crypto.randomUUID()}`;
  const started = performance.now();
  const timestamp = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Client-Request-Id": clientRequestId
      },
      body: JSON.stringify({ model, input }),
      signal: controller.signal,
      cache: "no-store"
    });

    const latencyMs = Math.round(performance.now() - started);
    const requestId = response.headers.get("x-request-id");
    const rawBody = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(rawBody);
    } catch {
      responseBody = { raw: rawBody };
    }
    const status = response.status;
    const message = response.ok
      ? "Request completed successfully."
      : (responseBody as any)?.error?.message || `HTTP ${status}`;

    const telemetry: Telemetry = {
      source: "live",
      kind: classify(status),
      status,
      message,
      requestId,
      clientRequestId,
      model,
      latencyMs,
      timestamp,
      attempts: 1,
      responseBody
    };
    const diagnosis = diagnose(telemetry);
    return NextResponse.json({ telemetry, diagnosis, escalation: escalationPacket(telemetry, diagnosis) }, { status: response.ok ? 200 : status });
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    const message = error instanceof Error ? error.message : "Unknown network error";
    const telemetry: Telemetry = {
      source: "live",
      kind: "timeout",
      status: null,
      message,
      requestId: null,
      clientRequestId,
      model,
      latencyMs,
      timestamp,
      attempts: 1
    };
    const diagnosis = diagnose(telemetry);
    return NextResponse.json({ telemetry, diagnosis, escalation: escalationPacket(telemetry, diagnosis) }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
