import type { Telemetry } from "./types";

const now = () => new Date().toISOString();

export const scenarios: Record<string, Omit<Telemetry, "timestamp">> = {
  auth: {
    source: "synthetic",
    kind: "auth",
    status: 401,
    message: "Incorrect API key provided.",
    requestId: "req_demo_auth_01",
    clientRequestId: "tp_demo_auth_01",
    model: "gpt-5.6-luna",
    latencyMs: 184,
    attempts: 1
  },
  permission: {
    source: "synthetic",
    kind: "permission",
    status: 403,
    message: "Project does not have access to the requested resource.",
    requestId: "req_demo_perm_01",
    clientRequestId: "tp_demo_perm_01",
    model: "gpt-5.6-luna",
    latencyMs: 210,
    attempts: 1
  },
  rate_limit: {
    source: "synthetic",
    kind: "rate_limit",
    status: 429,
    message: "Rate limit reached for requests per minute.",
    requestId: "req_demo_429_01",
    clientRequestId: "tp_demo_429_01",
    model: "gpt-5.6-luna",
    latencyMs: 133,
    attempts: 3
  },
  timeout: {
    source: "synthetic",
    kind: "timeout",
    status: null,
    message: "Client timeout after 10,000ms before a complete response was received.",
    requestId: null,
    clientRequestId: "tp_demo_timeout_01",
    model: "gpt-5.6-luna",
    latencyMs: 10000,
    attempts: 1
  },
  server: {
    source: "synthetic",
    kind: "server",
    status: 500,
    message: "Internal server error.",
    requestId: "req_demo_500_01",
    clientRequestId: "tp_demo_500_01",
    model: "gpt-5.6-luna",
    latencyMs: 842,
    attempts: 2
  },
  bad_request: {
    source: "synthetic",
    kind: "bad_request",
    status: 400,
    message: "Invalid request payload: unsupported parameter combination.",
    requestId: "req_demo_400_01",
    clientRequestId: "tp_demo_400_01",
    model: "gpt-5.6-luna",
    latencyMs: 156,
    attempts: 1
  }
};

export function getScenario(key: string): Telemetry | null {
  const scenario = scenarios[key];
  if (!scenario) return null;
  return { ...scenario, timestamp: now() };
}
