# Tracepoint architecture

Tracepoint models a support-engineering incident workflow rather than a general-purpose AI chat application.

```mermaid
flowchart LR
    A[Customer symptom or synthetic scenario] --> B[Telemetry normalization]
    B --> C[Deterministic classifier]
    C --> D[Evidence-backed diagnosis]
    D --> E[Next diagnostic checks]
    D --> F[Customer status update]
    D --> G[Engineering escalation packet]
    H[Live OpenAI Responses API probe] --> B
    I[Python CLI / logs] --> B
```

## 1. Incident sources

Tracepoint accepts two kinds of evidence:

- **Synthetic scenarios** let the UI exercise known failure classes without creating real failures or requiring an API key.
- **Live probes** call the OpenAI Responses API from a server-side Next.js route and record the resulting request metadata.

Both paths are converted to the same `Telemetry` shape. The diagnosis layer does not need to know whether the event came from a synthetic scenario or a live probe.

## 2. Telemetry layer

The normalized incident record includes:

- HTTP status, when a response was received
- timestamp
- model
- measured request latency
- OpenAI `x-request-id`, when returned
- caller-generated `X-Client-Request-Id`
- attempt count
- error or success message

This preserves the context needed to compare samples and prepare a technical handoff.

## 3. Deterministic diagnosis

`lib/diagnostics.ts` classifies known failure families before any generative model is involved:

- 400: request validation / integration
- 401: authentication
- 403: authorization / permissions
- 429: rate limit / capacity
- no completed response: timeout / network path
- 5xx: upstream / server error
- successful response: healthy baseline

The rules return severity, likely cause, evidence, next checks, a customer-facing update, and whether engineering escalation is warranted.

This keeps known signals deterministic and auditable instead of asking a model to infer basic HTTP failure classes.

## 4. Live API probe

`app/api/probe/route.ts` keeps `OPENAI_API_KEY` on the server. The browser calls the local `/api/probe` route, which then calls `POST /v1/responses`.

The route:

1. generates a client request ID
2. starts a latency timer
3. sends a minimal Responses API request
4. captures HTTP status and `x-request-id`
5. normalizes the response into `Telemetry`
6. passes the telemetry through the diagnostic engine
7. returns telemetry, diagnosis, and escalation data to the UI

The API key is never sent to the browser.

## 5. Escalation packet

Tracepoint structures the technical handoff around:

- observed status and error
- request/client-request IDs
- model
- timestamp
- latency
- support-side diagnosis
- checks already completed
- next checks
- a precise engineering ask

The goal is to reduce back-and-forth between Support and Engineering by preserving the evidence needed to continue an investigation.

## 6. Python tooling

The Python scripts expose the same workflow outside the web UI:

- `live_probe.py` performs a minimal API health probe and emits JSON telemetry.
- `incident_triage.py` accepts JSON telemetry and returns a diagnosis and escalation packet.

This keeps the incident model reusable across both the application and command-line workflows.
