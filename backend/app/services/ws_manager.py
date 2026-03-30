import json
from datetime import datetime, timezone
from typing import Dict
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self):
        # job_id -> list of WebSocket connections
        self.job_connections: Dict[str, list[WebSocket]] = {}
        # dashboard connections
        self.dashboard_connections: list[WebSocket] = []

    async def connect_job(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        if job_id not in self.job_connections:
            self.job_connections[job_id] = []
        self.job_connections[job_id].append(websocket)

    async def connect_dashboard(self, websocket: WebSocket):
        await websocket.accept()
        self.dashboard_connections.append(websocket)

    def disconnect_job(self, job_id: str, websocket: WebSocket):
        if job_id in self.job_connections:
            try:
                self.job_connections[job_id].remove(websocket)
            except ValueError:
                pass
            if not self.job_connections[job_id]:
                del self.job_connections[job_id]

    def disconnect_dashboard(self, websocket: WebSocket):
        try:
            self.dashboard_connections.remove(websocket)
        except ValueError:
            pass

    async def broadcast_job_update(self, job_id: str, data: dict):
        """Send status update to all clients watching a specific job."""
        if job_id not in self.job_connections:
            return
        message = json.dumps(data)
        dead = []
        for ws in self.job_connections[job_id]:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_job(job_id, ws)

    async def broadcast_dashboard(self, data: dict):
        """Send aggregated metrics to all dashboard connections."""
        message = json.dumps(data)
        dead = []
        for ws in self.dashboard_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_dashboard(ws)

    def _make_update(self, job_id: str, status: str, progress: int = 0,
                     result=None, error: str = None) -> dict:
        return {
            "event": "status_update",
            "job_id": job_id,
            "status": status,
            "progress": progress,
            "result": result,
            "error": error,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# Singleton manager used across the app
manager = ConnectionManager()
