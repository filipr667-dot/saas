"""System identity collector - Phase 1's core, always-enabled check.

Collects hostname, logged-in username, OS version, and a UTC timestamp:
the fields the backend's /checkin endpoint requires.
"""
from __future__ import annotations

import getpass
import logging
import platform
import socket
from datetime import datetime, timezone
from typing import Any, Dict

logger = logging.getLogger(__name__)

COLLECTOR_NAME = "system_info"
ENABLED = True


def collect() -> Dict[str, Any]:
    """Return hostname, username, os_version, and an ISO-8601 UTC timestamp."""
    return {
        "hostname": _get_hostname(),
        "username": _get_username(),
        "os_version": _get_os_version(),
        "timestamp": _get_timestamp(),
    }


def _get_hostname() -> str:
    try:
        return socket.gethostname()
    except Exception:
        logger.exception("Failed to resolve hostname")
        return "unknown-host"


def _get_username() -> str:
    try:
        return getpass.getuser()
    except Exception:
        logger.exception("Failed to resolve current username")
        return "unknown-user"


def _get_os_version() -> str:
    """Build a human-readable OS version string, e.g. 'Windows 11 Pro'."""
    try:
        system = platform.system()
        if system == "Windows":
            release = platform.release()
            edition = None
            try:
                edition = platform.win32_edition()  # type: ignore[attr-defined]
            except Exception:
                edition = None
            parts = [p for p in (system, release, edition) if p]
            return " ".join(parts)
        return f"{system} {platform.release()}".strip()
    except Exception:
        logger.exception("Failed to resolve OS version")
        return platform.system() or "unknown-os"


def _get_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
