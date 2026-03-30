from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from app.database import get_db
from app.models.job import Job, JobStatus
from app.models.task import Task, TaskType
from app.services import queue_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _get_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    return auth[7:] if auth.startswith("Bearer ") else ""


@router.get("/summary")
async def metrics_summary(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user = await get_current_user(token, db)

    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_1h = now - timedelta(hours=1)

    # Total jobs
    total_r = await db.execute(select(func.count()).where(Job.user_id == user.id))
    total_jobs = total_r.scalar_one()

    # By status
    status_r = await db.execute(
        select(Job.status, func.count()).where(Job.user_id == user.id).group_by(Job.status)
    )
    by_status = {s.value: 0 for s in JobStatus}
    for row in status_r:
        by_status[row[0].value] = row[1]

    # By type
    type_r = await db.execute(
        select(Task.task_type, func.count(Job.id))
        .join(Task, Job.task_id == Task.id)
        .where(Job.user_id == user.id)
        .group_by(Task.task_type)
    )
    by_type = {t.value: 0 for t in TaskType}
    for row in type_r:
        by_type[row[0].value] = row[1]

    # Avg execution time
    avg_r = await db.execute(
        select(func.avg(Job.execution_time_ms)).where(
            and_(Job.user_id == user.id, Job.execution_time_ms.isnot(None))
        )
    )
    avg_exec = avg_r.scalar_one() or 0

    # Success rate
    completed = by_status.get("COMPLETED", 0)
    failed = by_status.get("FAILED", 0)
    success_rate = (completed / (completed + failed)) * 100 if (completed + failed) > 0 else 0.0

    # Jobs last 24h / last 1h
    r24 = await db.execute(
        select(func.count()).where(and_(Job.user_id == user.id, Job.created_at >= last_24h))
    )
    r1h = await db.execute(
        select(func.count()).where(and_(Job.user_id == user.id, Job.created_at >= last_1h))
    )

    queue_stats = await queue_service.get_queue_stats()

    return {
        "success": True,
        "data": {
            "total_jobs": total_jobs,
            "by_status": by_status,
            "by_type": by_type,
            "queue_depth": queue_stats["pending"],
            "avg_execution_time_ms": round(avg_exec, 2),
            "success_rate": round(success_rate, 2),
            "jobs_last_24h": r24.scalar_one(),
            "jobs_last_hour": r1h.scalar_one(),
        },
        "error": None,
    }


@router.get("/timeseries")
async def metrics_timeseries(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user = await get_current_user(token, db)

    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)

    result = await db.execute(
        select(
            func.date_trunc("hour", Job.created_at).label("hour"),
            func.count().label("count"),
        )
        .where(and_(Job.user_id == user.id, Job.created_at >= last_24h))
        .group_by("hour")
        .order_by("hour")
    )
    rows = result.all()

    # Fill in all 24 hours including zeros
    hours_map = {row[0]: row[1] for row in rows}
    timeseries = []
    for i in range(24):
        hour = (now - timedelta(hours=23 - i)).replace(minute=0, second=0, microsecond=0)
        # Normalize to UTC naive for comparison
        count = hours_map.get(hour, 0)
        timeseries.append({
            "hour": hour.strftime("%H:00"),
            "count": count,
            "timestamp": hour.isoformat(),
        })

    return {"success": True, "data": timeseries, "error": None}


@router.get("/worker-health")
async def worker_health(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    await get_current_user(token, db)

    workers = await queue_service.get_active_workers()
    queue_stats = await queue_service.get_queue_stats()

    return {
        "success": True,
        "data": {
            "active_workers": len(workers),
            "worker_ids": workers,
            "queue_stats": queue_stats,
            "healthy": len(workers) > 0,
        },
        "error": None,
    }
