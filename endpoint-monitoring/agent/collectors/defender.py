"""Placeholder collector for Microsoft Defender status.

Future implementation will use the `MSFT_MpComputerStatus` WMI class (or
the `Get-MpComputerStatus` PowerShell cmdlet) to report real-time
protection state, signature age, and last scan time.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

COLLECTOR_NAME = "defender"
ENABLED = False  # Planned for a future phase


def collect() -> Dict[str, Any]:
    """Not implemented yet - raises so callers know to skip this check."""
    raise NotImplementedError(f"{COLLECTOR_NAME} collector is not implemented yet")
