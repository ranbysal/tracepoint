import type { Diagnosis, Telemetry } from "./types";

function baseEvidence(t: Telemetry): string[] {
  const evidence = [
    `source=${t.source}`,
    `status=${t.status ?? "none"}`,
    `latency_ms=${t.latencyMs}`,
    `timestamp=${t.timestamp}`
  ];
  if (t.requestId) evidence.push(`x-request-id=${t.requestId}`);
  if (t.clientRequestId) evidence.push(`x-client-request-id=${t.clientRequestId}`);
  if (t.model) evidence.push(`model=${t.model}`);
  return evidence;
}

export function diagnose(t: Telemetry): Diagnosis {
  const evidence = baseEvidence(t);

  if (t.kind === "auth" || t.status === 401) {
    return {
      severity: "SEV-3",
      category: "Authentication",
      likelyCause: "The request was not authenticated with a valid API credential or the credential is unavailable in the runtime.",
      evidence,
      nextChecks: [
        "Confirm the API key is present only on the server and is loaded in the deployed environment.",
        "Verify the key belongs to the intended OpenAI project/organization.",
        "Compare local and production environment-variable configuration.",
        "Capture the exact error body and request ID before rotating credentials."
      ],
      customerMessage: "We have isolated the failure to authentication. We are validating the credential and project configuration and will update you with the exact corrective action.",
      escalationNeeded: false,
      escalationReason: "Escalate only if a known-valid credential consistently receives 401 responses and the request reaches OpenAI."
    };
  }

  if (t.kind === "permission" || t.status === 403) {
    return {
      severity: "SEV-3",
      category: "Authorization / permissions",
      likelyCause: "The credential was recognized, but the project, model, endpoint, or organization policy does not permit the requested action.",
      evidence,
      nextChecks: [
        "Verify project membership and role permissions.",
        "Confirm the selected model/endpoint is available to the project.",
        "Check organization policy or workspace restrictions.",
        "Reproduce with the smallest valid request using the same project."
      ],
      customerMessage: "Authentication is succeeding, but the request is being rejected at the authorization layer. We are checking project and model permissions next.",
      escalationNeeded: false,
      escalationReason: "Escalate if permissions appear correct and a minimal reproduction still fails."
    };
  }

  if (t.kind === "rate_limit" || t.status === 429) {
    return {
      severity: "SEV-2",
      category: "Rate limit / capacity",
      likelyCause: "The workload exceeded a request/token limit or generated a short burst that crossed a quantized rate-limit window.",
      evidence,
      nextChecks: [
        "Inspect the exact 429 message to identify the constrained dimension.",
        "Compare requests-per-minute and tokens-per-minute against the project's limits.",
        "Check for bursty concurrency rather than relying only on per-minute averages.",
        "Add bounded exponential backoff with jitter and avoid immediate repeated retries.",
        "Confirm the request is using the intended organization/project."
      ],
      customerMessage: "We reproduced the issue as rate limiting. We are checking whether the constraint is request volume, token volume, or burst concurrency and will apply bounded backoff while we validate limits.",
      escalationNeeded: t.source === "live",
      escalationReason: "Escalate when the observed traffic is below the documented/project limits or the customer has a sustained production impact."
    };
  }

  if (t.kind === "timeout" || t.status === null) {
    return {
      severity: "SEV-2",
      category: "Timeout / network path",
      likelyCause: "The client did not receive a completed HTTP response before its timeout, which can originate in the client, proxy, network path, or upstream service.",
      evidence,
      nextChecks: [
        "Compare client timeout settings with proxy/load-balancer timeout settings.",
        "Determine whether a request ID exists; absence can indicate the request never reached the API.",
        "Test a minimal request from the same production network path.",
        "Record P50/P95/P99 latency and timestamps instead of relying on isolated examples.",
        "Check OpenAI status/service-health data for the same time window."
      ],
      customerMessage: "The failure is currently classified as a timeout rather than an API error. We are narrowing whether it occurs before the request reaches OpenAI or while waiting for the response.",
      escalationNeeded: true,
      escalationReason: "Escalate if multiple production requests time out with correlated timestamps or request IDs."
    };
  }

  if (t.kind === "server" || (t.status !== null && t.status >= 500)) {
    return {
      severity: "SEV-2",
      category: "Upstream / server error",
      likelyCause: "The request reached the service but failed with a server-side response.",
      evidence,
      nextChecks: [
        "Capture request IDs and timestamps for multiple failures.",
        "Measure error percentage, not only raw error count.",
        "Check whether failures are isolated to one model, project, or endpoint.",
        "Retry only idempotent/safe operations with bounded exponential backoff.",
        "Check OpenAI status and prepare a minimal reproducible request."
      ],
      customerMessage: "We have confirmed server-side failures and are collecting request IDs, timestamps, model scope, and error rate so the issue can be investigated efficiently.",
      escalationNeeded: true,
      escalationReason: "Multiple 5xx responses with production impact should be escalated with request IDs and a minimal reproduction."
    };
  }

  if (t.kind === "bad_request" || (t.status !== null && t.status >= 400)) {
    return {
      severity: "SEV-3",
      category: "Request validation / integration",
      likelyCause: "The API rejected the request shape, parameter combination, payload size, or endpoint/model combination.",
      evidence,
      nextChecks: [
        "Read the exact error code/message and identify the failing field.",
        "Reduce to a minimal request and add parameters back incrementally.",
        "Validate JSON types and required fields against the current API reference.",
        "Check context/input limits and unsupported parameter combinations.",
        "Compare the failing request with a known-good request from the same environment."
      ],
      customerMessage: "The request is reaching the API but is failing validation. We are reducing it to the smallest reproducible payload and comparing it against the current endpoint schema.",
      escalationNeeded: false,
      escalationReason: "Escalate only if the minimal request matches the documented schema and still fails unexpectedly."
    };
  }

  return {
    severity: "SEV-4",
    category: "Healthy request",
    likelyCause: "No incident detected in this probe.",
    evidence,
    nextChecks: [
      "Preserve the request ID and latency as a known-good baseline.",
      "Compare failing production samples against this baseline.",
      "Track latency distributions if the reported problem is intermittent."
    ],
    customerMessage: "The probe completed successfully. We have preserved its request metadata as a known-good comparison point.",
    escalationNeeded: false,
    escalationReason: "No escalation is required for this sample."
  };
}

export function escalationPacket(t: Telemetry, d: Diagnosis) {
  return {
    title: `${d.severity}: ${d.category}`,
    impact: d.severity === "SEV-2" ? "Production functionality may be degraded or blocked." : "Limited or no confirmed production-wide impact.",
    observed: {
      status: t.status,
      error: t.message,
      request_id: t.requestId,
      client_request_id: t.clientRequestId,
      model: t.model,
      latency_ms: t.latencyMs,
      timestamp: t.timestamp,
      source: t.source
    },
    diagnosis: d.likelyCause,
    checks_completed: d.evidence,
    next_checks: d.nextChecks,
    engineering_ask: d.escalationNeeded
      ? "Please correlate the supplied request ID(s) and timestamps with service-side telemetry and confirm whether the failure is expected behavior, capacity-related, or a platform defect."
      : "No engineering action requested yet. Continue support-side isolation and escalate only if the documented checks fail."
  };
}
