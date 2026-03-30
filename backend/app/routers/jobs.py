import uuid
import math
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.database import get_db
from app.models.job import Job, JobStatus
from app.models.task import Task
from app.schemas.job import JobSubmit, JobResponse, JobListResponse
from app.services.auth_service import get_current_user
from app.services import queue_service
from app.services.ws_manager import manager
from app.models.user import User

router = APIRouter(prefix="/jobs", tags=["jobs"])
PER_PAGE = 20


def _get_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    return auth[7:] if auth.startswith("Bearer ") else ""


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def submit_job(
    payload: JobSubmit,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)

    # Verify task belongs to user
    task_result = await db.execute(
        select(Task).where(and_(Task.id == payload.task_id, Task.user_id == user.id, Task.is_deleted == False))
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    job = Job(
        id=uuid.uuid4(),
        task_id=task.id,
        user_id=user.id,
        status=JobStatus.PENDING,
        priority=payload.priority,
        queued_at=datetime.now(timezone.utc),
    )
    db.add(job)
    await db.flush()
    # Enqueue into Redis
    await queue_service.enqueue(str(job.id), payload.priority)
    job.status = JobStatus.QUEUED
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # Notify WS
    await manager.broadcast_job_update(str(job.id), manager._make_update(
        str(job.id), "QUEUED", progress=0
    ))
    return JobResponse.model_validate(job)


@router.get("", response_model=JobListResponse)
async def list_jobs(
    request: Request,
    page: int = 1,
    status_filter: str | None = Query(None, alias="status"),
    sort_by: str = Query("created_at", regex="^(created_at|priority|execution_time_ms)$"),
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)

    filters = [Job.user_id == user.id]
    if status_filter:
        try:
            filters.append(Job.status == JobStatus(status_filter.upper()))
        except ValueError:
            pass

    count_q = await db.execute(select(func.count()).where(and_(*filters)))
    total = count_q.scalar_one()

    sort_col = getattr(Job, sort_by, Job.created_at)
    offset = (page - 1) * PER_PAGE
    result = await db.execute(
        select(Job).where(and_(*filters)).order_by(sort_col.desc()).offset(offset).limit(PER_PAGE)
    )
    jobs = result.scalars().all()
    return JobListResponse(
        items=[JobResponse.model_validate(j) for j in jobs],
        total=total,
        page=page,
        per_page=PER_PAGE,
        total_pages=math.ceil(total / PER_PAGE) if total else 1,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)
    result = await db.execute(
        select(Job).where(and_(Job.id == job_id, Job.user_id == user.id))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(
    job_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)
    result = await db.execute(
        select(Job).where(and_(Job.id == job_id, Job.user_id == user.id))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.PENDING, JobStatus.QUEUED):
        raise HTTPException(status_code=400, detail="Only PENDING or QUEUED jobs can be cancelled")
    await queue_service.cancel_job(str(job.id))
    job.status = JobStatus.CANCELLED
    job.completed_at = datetime.now(timezone.utc)
    db.add(job)
    await db.flush()
    await db.refresh(job)
    await manager.broadcast_job_update(str(job.id), manager._make_update(str(job.id), "CANCELLED"))
    return JobResponse.model_validate(job)


@router.post("/{job_id}/retry", response_model=JobResponse)
async def retry_job(
    job_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)
    result = await db.execute(
        select(Job).where(and_(Job.id == job_id, Job.user_id == user.id))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.FAILED, JobStatus.CANCELLED):
        raise HTTPException(status_code=400, detail="Only FAILED or CANCELLED jobs can be retried")
    job.retry_count = 0
    job.status = JobStatus.QUEUED
    job.error_message = None
    job.result = None
    job.queued_at = datetime.now(timezone.utc)
    job.started_at = None
    job.completed_at = None
    job.execution_time_ms = None
    db.add(job)
    await db.flush()
    await queue_service.enqueue(str(job.id), job.priority)
    await db.refresh(job)
    await manager.broadcast_job_update(str(job.id), manager._make_update(str(job.id), "QUEUED"))
    return JobResponse.model_validate(job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)
    result = await db.execute(
        select(Job).where(and_(Job.id == job_id, Job.user_id == user.id))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Also remove from Redis if in queue
    await queue_service.cancel_job(str(job.id))
    await db.delete(job)
