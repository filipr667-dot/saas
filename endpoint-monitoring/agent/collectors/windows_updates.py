"""Placeholder collector for Windows Update status.

Future implementation will use the `Microsoft.Update.Session` COM API (or
`Get-HotFix` / the PSWindowsUpdate module) to report pending updates,
last install date, and whether a reboot is required.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

COLLECTOR_NAME = "windows_updates"
ENABLED = False  # Planned for a future phase


def collect() -> Dict[str, Any]:
    """Not implemented yet - raises so callers know to skip this check."""
    raise NotImplementedError(f"{COLLECTOR_NAME} collector is not implemented yet")
