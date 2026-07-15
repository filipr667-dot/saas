#!/usr/bin/env bash
# Starts the FastAPI backend. Run ./setup.sh first.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

if [ -f "venv/Scripts/activate" ]; then
  source venv/Scripts/activate
elif [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
else
  echo "ERROR: venv not found in backend/. Run ./setup.sh first."
  exit 1
fi

uvicorn main:app --host 0.0.0.0 --port 8000
