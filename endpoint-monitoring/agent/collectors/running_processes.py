"""Placeholder collector for running process enumeration.

Future implementation will list active processes (e.g. via `psutil` or
`Get-Process`), reporting PID, name, executable path, and owner - useful
for later anomaly/threat detection features.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

COLLECTOR_NAME = "running_processes"
ENABLED = False  # Planned for a future phase


def collect() -> Dict[str, Any]:
    """Not implemented yet - raises so callers know to skip this check."""
    raise NotImplementedError(f"{COLLECTOR_NAME} collector is not implemented yet")
