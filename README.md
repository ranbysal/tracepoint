# Tracepoint

**AI Support Incident Console**

Tracepoint is a support-engineering portfolio project focused on a real operational problem: turning ambiguous OpenAI API failures into structured, evidence-backed incident investigations.

It demonstrates the workflow behind high-quality technical support rather than another generic chatbot:

- reproduce known failure classes with synthetic incidents
- run a live OpenAI Responses API health probe
- capture HTTP status, latency, timestamps, `x-request-id`, and a caller-generated `X-Client-Request-Id`
- classify 400, 401, 403, 429, timeout, and 5xx incidents
- produce deterministic next checks and customer-facing status updates
- generate an engineering-ready escalation packet
- provide a Python triage CLI and a Python live API probe

## Why this project exists

Complex API support is mostly about evidence quality. A good escalation should answer: what failed, when, where, how often, with which request IDs, under which model/project context, and how to reproduce it.

OpenAI's public support guidance recommends preserving request IDs and correlated timestamps for API troubleshooting. It also recommends bounded exponential backoff for rate-limit errors and filtering troubleshooting data to the relevant model/project/time range.

## Stack

- Next.js 15
- React 19
- TypeScript
- Python 3
- OpenAI Responses API over raw HTTP
- Vercel-ready frontend/server route

## Run locally

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

The synthetic incident buttons work without an API key. The live probe requires `OPENAI_API_KEY`.

## Python support tooling

Run a synthetic incident through the deterministic triage engine:

```bash
python scripts/incident_triage.py examples/incident-429.json
```

Run a live API probe:

```bash
export OPENAI_API_KEY="..."
python scripts/live_probe.py
```

Then pipe the resulting telemetry into the triage tool:

```bash
python scripts/live_probe.py > /tmp/probe.json
python scripts/incident_triage.py /tmp/probe.json
```

## Incident model

Tracepoint currently distinguishes:

| Failure | Signal | Primary investigation |
| --- | --- | --- |
| Request validation | 400 | schema, payload, model/endpoint compatibility |
| Authentication | 401 | API key and runtime/project configuration |
| Authorization | 403 | project/model permissions and policy |
| Rate limit | 429 | RPM/TPM, bursts, retry strategy, project limits |
| Timeout | no completed HTTP response | client/proxy/network path vs upstream latency |
| Server error | 5xx | request IDs, timestamps, model scope, error percentage |

## Security notes

- API keys remain server-side.
- The browser never receives `OPENAI_API_KEY`.
- Support evidence should never include secrets or Authorization headers.
- This project stores no incident data by default.

## Next milestones

1. Incident history with SQLite/Postgres.
2. Retry simulation with exponential backoff + jitter visualization.
3. Streaming probe and first-token latency measurement.
4. Batch incident ingestion from JSON/CSV logs.
5. Redaction layer for secrets/PII before escalation.
6. AI-assisted diagnosis as a secondary layer after deterministic triage.
7. Automated tests for classification and escalation behavior.

## Portfolio framing

**Tracepoint - AI Support Incident Console**  
Built a support engineering lab for OpenAI API incidents that captures request IDs, latency, timestamps, status codes, and reproduction context; classifies common integration failures; and generates structured customer updates and engineering escalation packets. Added Python tooling for live probes and deterministic incident triage.

## Tests

```bash
python -m unittest discover -s tests -v
```

## Reference material

- OpenAI Responses API: https://developers.openai.com/api/reference/
- OpenAI model guidance: https://developers.openai.com/api/docs/models
- OpenAI rate-limit troubleshooting: https://help.openai.com/en/articles/6891753-api-rate-limit-advice
- OpenAI API errors and latency troubleshooting: https://help.openai.com/en/articles/1000499
