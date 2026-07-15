#!/usr/bin/env bash
# Starts the Windows agent. Run ./setup.sh first, and start the backend
# (./run_backend.sh) before or shortly after this.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/agent"

if [ -f "venv/Scripts/activate" ]; then
  source venv/Scripts/activate
elif [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
else
  echo "ERROR: venv not found in agent/. Run ./setup.sh first."
  exit 1
fi

python agent.py
