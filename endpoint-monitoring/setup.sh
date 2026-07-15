#!/usr/bin/env bash
# One-shot setup for the endpoint monitoring prototype.
# Creates a virtualenv and installs dependencies for both the backend and
# the agent. Works in Git Bash on Windows and in bash/zsh on macOS/Linux.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Prefer the `py` launcher (registered by the official python.org Windows
# installer), then fall back to python3/python for macOS/Linux.
PYTHON_BIN=""
for candidate in py python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [ -z "$PYTHON_BIN" ]; then
  echo "ERROR: No Python interpreter found (tried: py, python3, python)."
  echo "Install Python from https://python.org/downloads - check 'Add Python to PATH' during install - then re-run this script."
  exit 1
fi

echo "Using Python: $("$PYTHON_BIN" --version)"

setup_component() {
  local name="$1"
  echo ""
  echo "Setting up $name..."
  cd "$SCRIPT_DIR/$name"
  "$PYTHON_BIN" -m venv venv
  # venv layout differs: Windows uses Scripts/, macOS/Linux uses bin/.
  if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
  else
    source venv/bin/activate
  fi
  pip install --quiet --upgrade pip
  pip install --quiet -r requirements.txt
  deactivate
  echo "$name ready."
}

setup_component backend
setup_component agent

echo ""
echo "Setup complete."
echo "Next steps (two separate terminals):"
echo "  1) ./run_backend.sh"
echo "  2) ./run_agent.sh"
echo "Then open http://localhost:8000/ in your browser."
