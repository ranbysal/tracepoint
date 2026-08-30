import importlib.util
import pathlib
import sys
import unittest

MODULE_PATH = pathlib.Path(__file__).parents[1] / "scripts" / "incident_triage.py"
spec = importlib.util.spec_from_file_location("incident_triage", MODULE_PATH)
incident_triage = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = incident_triage
assert spec.loader is not None
spec.loader.exec_module(incident_triage)

class IncidentTriageTests(unittest.TestCase):
    def test_401_authentication(self):
        d = incident_triage.diagnose({"status": 401, "request_id": "req_1"})
        self.assertEqual(d.category, "Authentication")
        self.assertFalse(d.escalation_needed)

    def test_429_rate_limit_escalates(self):
        d = incident_triage.diagnose({"status": 429, "request_id": "req_2"})
        self.assertEqual(d.severity, "SEV-2")
        self.assertTrue(d.escalation_needed)

    def test_timeout_without_status(self):
        d = incident_triage.diagnose({"status": None, "request_id": None})
        self.assertEqual(d.category, "Timeout / network path")
        self.assertTrue(d.escalation_needed)

    def test_success_is_baseline(self):
        d = incident_triage.diagnose({"status": 200, "request_id": "req_ok"})
        self.assertEqual(d.severity, "SEV-4")
        self.assertFalse(d.escalation_needed)

if __name__ == "__main__":
    unittest.main()
