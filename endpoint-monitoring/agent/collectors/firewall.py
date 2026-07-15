"""Placeholder collector for Windows Firewall status.

Future implementation will query firewall profile state (Domain, Private,
Public) via `Get-NetFirewallProfile` or the `netsh advfirewall` command
and report whether each profile is enabled.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

COLLECTOR_NAME = "firewall"
ENABLED = False  # Planned for a future phase


def collect() -> Dict[str, Any]:
    """Not implemented yet - raises so callers know to skip this check."""
    raise NotImplementedError(f"{COLLECTOR_NAME} collector is not implemented yet")
