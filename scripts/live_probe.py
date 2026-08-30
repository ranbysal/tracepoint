#!/usr/bin/env python3
"""Minimal Python OpenAI Responses API probe with request-ID and latency capture.

Environment:
  OPENAI_API_KEY required
  OPENAI_MODEL optional (defaults to gpt-5.6-luna)
"""
from __future__ import annotations

import json
import os
import time
import uuid
import urllib.error
import urllib.request

API_URL = "https://api.openai.com/v1/responses"


def main() -> int:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is required")
    model = os.environ.get("OPENAI_MODEL", "gpt-5.6-luna")
    client_request_id = f"tp_{uuid.uuid4()}"
    payload = json.dumps({"model": model, "input": "Return exactly: tracepoint python probe ok"}).encode()
    req = urllib.request.Request(API_URL, data=payload, method="POST", headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Client-Request-Id": client_request_id,
    })
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            body = json.loads(response.read())
            event = {
                "status": response.status,
                "request_id": response.headers.get("x-request-id"),
                "client_request_id": client_request_id,
                "model": model,
                "latency_ms": round((time.perf_counter() - started) * 1000),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "response_id": body.get("id"),
            }
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        event = {
            "status": exc.code,
            "request_id": exc.headers.get("x-request-id"),
            "client_request_id": client_request_id,
            "model": model,
            "latency_ms": round((time.perf_counter() - started) * 1000),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "error": raw,
        }
    except Exception as exc:
        event = {
            "status": None,
            "request_id": None,
            "client_request_id": client_request_id,
            "model": model,
            "latency_ms": round((time.perf_counter() - started) * 1000),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "error": repr(exc),
        }
    print(json.dumps(event, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
