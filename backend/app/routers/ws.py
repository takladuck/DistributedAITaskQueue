import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.ws_manager import manager
from app.services import queue_service

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/jobs/{job_id}")
async def ws_job(websocket: WebSocket, job_id: str):
    await manager.connect_job(job_id, websocket)
    try:
        # Send current Redis status immediately on connect
        redis_status = await queue_service.get_job_redis_status(job_id)
        if redis_status:
            await websocket.send_json({
                "event": "status_update",
                "job_id": job_id,
                "status": redis_status.get("status", "UNKNOWN"),
                "progress": int(redis_status.get("progress", 0)),
                "result": None,
                "error": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        # Keep connection alive — client may send pings
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_job(job_id, websocket)
    except Exception:
        manager.disconnect_job(job_id, websocket)


@router.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    await manager.connect_dashboard(websocket)
    try:
        while True:
            # Stream metrics every 5 seconds
            stats = await queue_service.get_queue_stats()
            workers = await queue_service.get_active_workers()
            await websocket.send_json({
                "event": "dashboard_update",
                "queue_stats": stats,
                "active_workers": len(workers),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            # Also listen for pings
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        manager.disconnect_dashboard(websocket)
    except Exception:
        manager.disconnect_dashboard(websocket)
