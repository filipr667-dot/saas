"""Windows Agent entry point.

Runs continuously: every CHECK_IN_INTERVAL_SECONDS it runs all enabled
collectors (see collectors/__init__.py), assembles a check-in payload,
and POSTs it to the FastAPI backend's /checkin endpoint.
"""
from __future__ import annotations

import logging
import os
import sys
import time
from typing import Any, Dict

import requests

from collectors import run_enabled_collectors

# ---------------------------------------------------------------------------
# Configuration (override via environment variables for different setups)
# ---------------------------------------------------------------------------
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
CHECKIN_ENDPOINT = f"{BACKEND_URL}/checkin"
CHECK_IN_INTERVAL_SECONDS = int(os.environ.get("CHECK_IN_INTERVAL_SECONDS", "60"))
REQUEST_TIMEOUT_SECONDS = 10

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("agent")


def build_payload() -> Dict[str, Any]:
    """Run all enabled collectors and assemble the check-in payload."""
    return run_enabled_collectors()


def send_checkin(payload: Dict[str, Any]) -> bool:
    """POST the collected payload to the backend. Returns True on success."""
    try:
        response = requests.post(CHECKIN_ENDPOINT, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        logger.info("Check-in succeeded for host '%s'", payload.get("hostname", "unknown"))
        return True
    except requests.exceptions.ConnectionError:
        logger.error("Could not connect to backend at %s", BACKEND_URL)
    except requests.exceptions.Timeout:
        logger.error("Check-in request to %s timed out", CHECKIN_ENDPOINT)
    except requests.exceptions.HTTPError as exc:
        logger.error("Backend rejected check-in: %s", exc)
    except requests.exceptions.RequestException:
        logger.exception("Unexpected error sending check-in")
    return False


def run_forever() -> None:
    """Main agent loop: collect + send every CHECK_IN_INTERVAL_SECONDS."""
    logger.info(
        "Starting Windows endpoint agent (interval=%ss, backend=%s)",
        CHECK_IN_INTERVAL_SECONDS,
        BACKEND_URL,
    )
    while True:
        try:
            payload = build_payload()
            send_checkin(payload)
        except Exception:
            logger.exception("Unexpected error during check-in cycle")
        time.sleep(CHECK_IN_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        run_forever()
    except KeyboardInterrupt:
        logger.info("Agent stopped by user")
        sys.exit(0)
