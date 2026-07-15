"""Collector registry for the Windows agent.

Each collector module lives in this package and exposes:
  - COLLECTOR_NAME: str            unique key identifying the check
  - ENABLED: bool                  whether it should run this phase
  - collect() -> dict[str, Any]    performs the check and returns data

`run_enabled_collectors()` is the single entry point agent.py calls each
cycle: it runs every enabled collector, merges their results into one
payload, and logs (without raising) any collector that fails so a broken
future check never takes down the whole check-in.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, NamedTuple

from . import (
    bitlocker,
    defender,
    firewall,
    installed_software,
    running_processes,
    system_info,
    windows_updates,
)

logger = logging.getLogger(__name__)


class Collector(NamedTuple):
    name: str
    enabled: bool
    collect: Callable[[], Dict[str, Any]]


# Phase 1 ships with only `system_info` enabled. The rest are registered as
# placeholders so future phases can flip ENABLED = True in each module
# without touching this registry or agent.py.
REGISTRY: List[Collector] = [
    Collector("system_info", system_info.ENABLED, system_info.collect),
    Collector("bitlocker", bitlocker.ENABLED, bitlocker.collect),
    Collector("defender", defender.ENABLED, defender.collect),
    Collector("firewall", firewall.ENABLED, firewall.collect),
    Collector("windows_updates", windows_updates.ENABLED, windows_updates.collect),
    Collector("installed_software", installed_software.ENABLED, installed_software.collect),
    Collector("running_processes", running_processes.ENABLED, running_processes.collect),
]


def run_enabled_collectors() -> Dict[str, Any]:
    """Run every enabled collector and merge their output into one payload.

    A collector that raises is logged and skipped so one failing check
    never prevents the rest of the check-in from being sent.
    """
    payload: Dict[str, Any] = {}
    for collector in REGISTRY:
        if not collector.enabled:
            logger.debug("Skipping disabled collector: %s", collector.name)
            continue
        try:
            payload.update(collector.collect())
        except Exception:
            logger.exception("Collector '%s' failed", collector.name)
    return payload
