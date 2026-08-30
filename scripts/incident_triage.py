#!/usr/bin/env python3
"""Normalize API telemetry into a support diagnosis and escalation packet.

Usage:
  python scripts/incident_triage.py examples/incident.json
  cat incident.json | python scripts/incident_triage.py -
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

@dataclass
class Diagnosis:
    severity: str
    category: str
    likely_cause: str
    next_checks: list[str]
    escalation_needed: bool


def diagnose(event: dict[str, Any]) -> Diagnosis:
    status = event.get("status")
    request_id = event.get("request_id")

    if status == 401:
        return Diagnosis("SEV-3", "Authentication", "Invalid/missing API credential or incorrect runtime configuration", [
            "Verify server-side key presence and deployed environment variables",
            "Verify the key belongs to the intended project/organization",
            "Preserve the exact error and x-request-id before changing credentials",
        ], False)
    if status == 403:
        return Diagnosis("SEV-3", "Authorization / permissions", "Credential is recognized but lacks permission for the requested resource", [
            "Verify project role and membership",
            "Confirm model/endpoint access",
            "Reduce to a minimal request with the same project",
        ], False)
    if status == 429:
        return Diagnosis("SEV-2", "Rate limit", "Request/token rate or short-burst concurrency exceeded an active limit", [
            "Identify the constrained dimension from the exact 429 body",
            "Compare RPM/TPM and burst concurrency with project limits",
            "Use bounded exponential backoff with jitter",
            "Confirm the intended project/organization is being used",
        ], True)
    if status is None:
        return Diagnosis("SEV-2", "Timeout / network path", "No complete HTTP response was received before client timeout", [
            "Compare client, proxy, and load-balancer timeout values",
            "Check whether x-request-id exists; absence can indicate the request never reached the API",
            "Run a minimal request from the same network path",
            "Collect latency percentiles and correlated timestamps",
        ], True)
    if isinstance(status, int) and status >= 500:
        return Diagnosis("SEV-2", "Server error", "The request reached the service and returned a server-side failure", [
            "Collect multiple x-request-id values and timestamps",
            "Measure error percentage and model/project scope",
            "Check service status and retry safely with bounded backoff",
            "Prepare a minimal reproducible request",
        ], True)
    if isinstance(status, int) and status >= 400:
        return Diagnosis("SEV-3", "Request validation / integration", "The request was rejected because of payload or parameter validation", [
            "Read the exact API error code/message",
            "Reduce to the smallest reproducible payload",
            "Validate field types and endpoint/model compatibility",
        ], False)
    return Diagnosis("SEV-4", "Healthy request", "No incident detected", [
        "Preserve request ID and latency as a known-good baseline",
        "Compare failing samples to this successful request",
    ], False)


def packet(event: dict[str, Any], diagnosis: Diagnosis) -> dict[str, Any]:
    return {
        "title": f"{diagnosis.severity}: {diagnosis.category}",
        "observed": event,
        "diagnosis": diagnosis.likely_cause,
        "next_checks": diagnosis.next_checks,
        "engineering_escalation": diagnosis.escalation_needed,
        "engineering_ask": (
            "Correlate the supplied request ID(s) and timestamps with service-side telemetry and confirm expected behavior vs platform defect."
            if diagnosis.escalation_needed
            else "Continue support-side isolation before engineering escalation."
        ),
        "request_id_present": bool(event.get("request_id")),
    }


def read_event(path: str) -> dict[str, Any]:
    if path == "-":
        return json.load(sys.stdin)
    return json.loads(Path(path).read_text())


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: incident_triage.py <incident.json|->", file=sys.stderr)
        return 2
    event = read_event(sys.argv[1])
    diagnosis = diagnose(event)
    print(json.dumps({"diagnosis": asdict(diagnosis), "escalation": packet(event, diagnosis)}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
