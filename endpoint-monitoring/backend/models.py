"""Pydantic models shared by the endpoint monitoring backend.

Keeping request/response/domain models in one module makes it easy to
extend the schema (e.g. adding BitLocker or Defender status fields to
Device) without touching route logic in main.py.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class CheckinRequest(BaseModel):
    """Payload an agent sends on every check-in (see agent/agent.py)."""

    hostname: str = Field(..., description="Machine hostname, e.g. LAPTOP-001")
    username: str = Field(..., description="Currently logged-in username")
    os_version: str = Field(..., description="Human-readable OS version string")
    timestamp: str = Field(..., description="UTC ISO-8601 timestamp from the agent")


class CheckinResponse(BaseModel):
    """Acknowledgement returned to the agent after a successful check-in."""

    status: str
    hostname: str


class Device(BaseModel):
    """A known device as reported to the dashboard, with derived status."""

    hostname: str
    username: str
    os_version: str
    last_checkin: str
    online: bool
