export type IncidentKind = "bad_request" | "auth" | "permission" | "rate_limit" | "timeout" | "server" | "success";

export type Telemetry = {
  source: "synthetic" | "live";
  kind: IncidentKind;
  status: number | null;
  message: string;
  requestId: string | null;
  clientRequestId: string | null;
  model: string | null;
  latencyMs: number;
  timestamp: string;
  attempts: number;
  responseBody?: unknown;
};

export type Diagnosis = {
  severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
  category: string;
  likelyCause: string;
  evidence: string[];
  nextChecks: string[];
  customerMessage: string;
  escalationNeeded: boolean;
  escalationReason: string;
};
