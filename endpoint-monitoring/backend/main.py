"""FastAPI backend for the Windows endpoint monitoring prototype.

Phase 1 responsibilities:
  - Accept agent check-ins                 (POST /checkin)
  - Expose the current device roster       (GET  /devices)
  - Serve a simple auto-refreshing dashboard (GET /)

Storage is in-memory only for Phase 1 (a dict keyed by hostname). This is
intentionally swappable: a future phase can replace `_devices` and its
accessor functions with a real datastore (e.g. PostgreSQL) without changing
the route signatures below.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from models import CheckinRequest, CheckinResponse, Device

# ---------------------------------------------------------------------------
# Configuration & logging
# ---------------------------------------------------------------------------
ONLINE_THRESHOLD_SECONDS = 120  # A device is "online" if seen within this window
DASHBOARD_FILE = Path(__file__).parent / "dashboard.html"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("backend")

app = FastAPI(
    title="Endpoint Monitoring Backend",
    description="Phase 1 prototype backend for a future endpoint security platform.",
    version="0.1.0",
)

# The dashboard is served from the same origin, but CORS is left open so the
# API can be hit from a separately-hosted dashboard/client during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory storage (Phase 1 only - not persisted across restarts)
# ---------------------------------------------------------------------------
# Keyed by hostname so repeat check-ins update the same record. Guarded by a
# lock because FastAPI's sync endpoints can run concurrently in a threadpool.
_devices: Dict[str, dict] = {}
_devices_lock = Lock()


def _is_online(last_checkin_iso: str) -> bool:
    """A device counts as online if it checked in within the online window."""
    try:
        last_seen = datetime.fromisoformat(last_checkin_iso.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Could not parse check-in timestamp: %r", last_checkin_iso)
        return False
    age = datetime.now(timezone.utc) - last_seen
    return age <= timedelta(seconds=ONLINE_THRESHOLD_SECONDS)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.post("/checkin", response_model=CheckinResponse)
def checkin(payload: CheckinRequest) -> CheckinResponse:
    """Receive a device check-in and upsert its record in memory."""
    with _devices_lock:
        _devices[payload.hostname] = {
            "hostname": payload.hostname,
            "username": payload.username,
            "os_version": payload.os_version,
            "last_checkin": payload.timestamp,
        }
    logger.info("Check-in received from '%s' (user=%s)", payload.hostname, payload.username)
    return CheckinResponse(status="ok", hostname=payload.hostname)


@app.get("/devices", response_model=List[Device])
def list_devices() -> List[Device]:
    """Return every known device with a derived online/offline status."""
    with _devices_lock:
        snapshot = list(_devices.values())

    return [
        Device(
            hostname=d["hostname"],
            username=d["username"],
            os_version=d["os_version"],
            last_checkin=d["last_checkin"],
            online=_is_online(d["last_checkin"]),
        )
        for d in snapshot
    ]


@app.get("/", response_class=HTMLResponse)
def dashboard() -> str:
    """Serve the static dashboard page (its JS polls /devices)."""
    try:
        return DASHBOARD_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.error("dashboard.html not found at %s", DASHBOARD_FILE)
        raise HTTPException(status_code=500, detail="Dashboard file missing")
