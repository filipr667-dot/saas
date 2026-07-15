"""Placeholder collector for installed software inventory.

Future implementation will enumerate installed applications from the
registry uninstall keys (`HKLM/HKCU ...\\Uninstall`) or via
`Get-Package`/`Win32_Product`, reporting name, version, and publisher.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

COLLECTOR_NAME = "installed_software"
ENABLED = False  # Planned for a future phase


def collect() -> Dict[str, Any]:
    """Not implemented yet - raises so callers know to skip this check."""
    raise NotImplementedError(f"{COLLECTOR_NAME} collector is not implemented yet")
