# Tracepoint

**AI Support Incident Console**

Tracepoint is an incident triage console for diagnosing API failures, normalizing request telemetry, and turning support evidence into a consistent technical handoff.

It includes a browser-based incident console, a live OpenAI Responses API probe, synthetic failure scenarios, and Python command-line tooling for reproducing the same triage workflow outside the UI.

## What it does

- Runs synthetic 400, 401, 403, 429, timeout, and 5xx incident scenarios.
- Runs a live server-side probe against the OpenAI Responses API.
- Captures HTTP status, latency, timestamps, model context, `x-request-id`, and a caller-generated `X-Client-Request-Id`.
- Normalizes incident data into a shared telemetry model.
- Classifies common failure families with deterministic rules.
- Produces evidence, recommended diagnostic checks, customer-facing status updates, and engineering escalation packets.
- Provides Python tools for live probing and JSON-based incident triage.

## Stack

- Next.js 15
- React 19
- TypeScript
- Python 3
- OpenAI Responses API over raw HTTP

## Architecture

```text
Customer report / synthetic scenario / live probe
                     |
                     v
             Telemetry normalization
                     |
                     v
            Deterministic diagnosis
                     |
          +----------+----------+
          |          |          |
          v          v          v
       Evidence   Next checks   Escalation packet
                              + customer update
```

The browser never receives the OpenAI API key. Live requests are made through the server-side `/api/probe` route, normalized into the same telemetry shape used by the synthetic scenarios, and then passed through the diagnostic engine.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Incident model

| Failure | Signal | Primary investigation |
| --- | --- | --- |
| Request validation | 400 | schema, payload, model/endpoint compatibility |
| Authentication | 401 | API key and runtime/project configuration |
| Authorization | 403 | project/model permissions and policy |
| Rate limit | 429 | RPM/TPM, bursts, retry strategy, project limits |
| Timeout | no completed HTTP response | client/proxy/network path vs upstream latency |
| Server error | 5xx | request IDs, timestamps, model scope, error percentage |

## Run locally

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Synthetic incidents work without an API key. The live probe requires `OPENAI_API_KEY`.

## Python tools

Run an incident through the deterministic triage engine:

```bash
python scripts/incident_triage.py examples/incident-429.json
```

Run a live API probe:

```bash
export OPENAI_API_KEY="..."
python scripts/live_probe.py
```

Pipe live telemetry directly into triage:

```bash
python scripts/live_probe.py > /tmp/probe.json
python scripts/incident_triage.py /tmp/probe.json
```

## Tests

```bash
python -m unittest discover -s tests -v
npm run typecheck
npm run build
```

GitHub Actions runs the Python tests and web checks on pushes to `main` and on pull requests.

## Security

- `OPENAI_API_KEY` remains server-side.
- Authorization headers and secrets are not included in incident evidence.
- No incident data is persisted by default.
