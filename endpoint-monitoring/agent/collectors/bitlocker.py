"""Placeholder collector for BitLocker disk encryption status.

Future implementation will query volume encryption state via WMI
(`Win32_EncryptableVolume`) or by shelling out to `manage-bde -status`,
and report per-volume protection status, encryption method, and key
protector types.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

COLLECTOR_NAME = "bitlocker"
ENABLED = False  # Planned for a future phase


def collect() -> Dict[str, Any]:
    """Not implemented yet - raises so callers know to skip this check."""
    raise NotImplementedError(f"{COLLECTOR_NAME} collector is not implemented yet")
