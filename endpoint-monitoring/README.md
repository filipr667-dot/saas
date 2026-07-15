# Windows Endpoint Monitoring Platform (Prototype)

Phase 1 foundation for a future endpoint security and management platform:
a Windows agent that reports basic host information to a FastAPI backend
every 60 seconds, and a dashboard that shows which devices are online.

## Project Structure

```
endpoint-monitoring/
├── backend/
│   ├── main.py            # FastAPI app: /checkin, /devices, dashboard route
│   ├── models.py          # Pydantic request/response/domain models
│   ├── dashboard.html     # Auto-refreshing device dashboard
│   └── requirements.txt
└── agent/
    ├── agent.py            # Agent entry point: collect + POST every 60s
    ├── collectors/         # One module per data collection check
    │   ├── system_info.py         # Phase 1 (enabled): hostname/user/OS/timestamp
    │   ├── bitlocker.py           # Placeholder - future phase
    │   ├── defender.py            # Placeholder - future phase
    │   ├── firewall.py            # Placeholder - future phase
    │   ├── windows_updates.py     # Placeholder - future phase
    │   ├── installed_software.py  # Placeholder - future phase
    │   └── running_processes.py   # Placeholder - future phase
    └── requirements.txt
```

Storage is in-memory only (a Python dict in `backend/main.py`) — data is
lost on backend restart. This is intentional for Phase 1; a real datastore
comes in a later phase.

## Installation

Requires Python 3.9+. Use separate virtual environments for the backend and
agent (they can also run on different machines).

### Backend

```bash
cd endpoint-monitoring/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Agent

```bash
cd endpoint-monitoring/agent
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Running

### 1. Start the backend

```bash
cd endpoint-monitoring/backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

- Dashboard: http://localhost:8000/
- Devices API: http://localhost:8000/devices

### 2. Start the agent

In a separate terminal (on the machine you want to monitor):

```bash
cd endpoint-monitoring/agent
python agent.py
```

The agent collects host info and sends it to `http://localhost:8000/checkin`
every 60 seconds. To point it at a different backend (e.g. a remote server),
set the `BACKEND_URL` environment variable before running:

```bash
BACKEND_URL=http://192.168.1.50:8000 python agent.py     # macOS/Linux
set BACKEND_URL=http://192.168.1.50:8000 && python agent.py   # Windows cmd
```

### 3. View the dashboard

Open http://localhost:8000/ in a browser. It polls `/devices` every 10
seconds and shows each device's hostname, username, OS version, last
check-in time, and Online/Offline status (online = checked in within the
last 120 seconds).

## Success Criteria Checklist

1. Agent collects hostname, username, OS version, and timestamp.
2. Agent POSTs that data to the backend every 60 seconds.
3. Backend stores/updates the device record in memory.
4. Dashboard lists the device with its latest info.
5. Dashboard auto-refreshes and reflects new check-ins and status changes.

## Extending with New Collectors

To add a new check (e.g. implementing the BitLocker placeholder):

1. Implement `collect()` in `agent/collectors/<name>.py` to return a dict.
2. Set `ENABLED = True` in that module.
3. It's picked up automatically by `collectors/__init__.py`'s registry —
   no changes needed in `agent.py`.
4. Extend `backend/models.py` (`Device`) if the new fields should be
   surfaced on the dashboard, and update `dashboard.html` to render them.
