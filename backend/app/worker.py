"""
Standalone worker process.
Run with: python -m app.worker
Polls Redis priority queue, executes AI tasks, updates DB, broadcasts WebSocket updates.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from app.database import async_session_factory
from app.models.job import Job, JobStatus
from app.models.task import Task
from app.services import queue_service, ai_service
from app.services.ws_manager import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [WORKER] %(message)s")
log = logging.getLogger(__name__)

WORKER_ID = os.environ.get("WORKER_ID", str(uuid.uuid4())[:8])


async def _update_job(job_id_str: str, **kwargs):
    """Update job fields in the database."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(Job).where(Job.id == uuid.UUID(job_id_str))
        )
        job = result.scalar_one_or_none()
        if not job:
            return None
        for k, v in kwargs.items():
            setattr(job, k, v)
        session.add(job)
        await session.commit()
        await session.refresh(job)
        return job


async def _get_job_with_task(job_id_str: str):
    """Fetch job and its associated task from DB."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(Job).where(Job.id == uuid.UUID(job_id_str))
        )
        job = result.scalar_one_or_none()
        if not job:
            return None, None
        task_result = await session.execute(
            select(Task).where(Task.id == job.task_id)
        )
        task = task_result.scalar_one_or_none()
        return job, task


async def process_job(job_id: str):
    """Process a single job: execute AI task and update DB."""
    job, task = await _get_job_with_task(job_id)
    if not job or not task:
        log.warning(f"Job or task not found: {job_id}")
        await queue_service.release_lock(job_id)
        return

    start_time = datetime.now(timezone.utc)

    # Mark as RUNNING
    await _update_job(
        job_id,
        status=JobStatus.RUNNING,
        started_at=start_time,
    )
    await queue_service.update_job_status(job_id, "RUNNING", 10)
    await manager.broadcast_job_update(job_id, manager._make_update(job_id, "RUNNING", 10))
    log.info(f"Processing job {job_id} | type={task.task_type} | priority={job.priority}")

    try:
        # Update progress
        await queue_service.update_job_status(job_id, "RUNNING", 30)
        await manager.broadcast_job_update(job_id, manager._make_update(job_id, "RUNNING", 30))

        # Execute AI task
        result = await ai_service.execute(task.task_type, task.payload)

        end_time = datetime.now(timezone.utc)
        exec_ms = int((end_time - start_time).total_seconds() * 1000)

        # Mark COMPLETED
        await _update_job(
            job_id,
            status=JobStatus.COMPLETED,
            result=result,
            completed_at=end_time,
            execution_time_ms=exec_ms,
            error_message=None,
        )
        await queue_service.update_job_status(job_id, "COMPLETED", 100)
        await manager.broadcast_job_update(
            job_id,
            manager._make_update(job_id, "COMPLETED", 100, result=result),
        )
        log.info(f"Job {job_id} completed in {exec_ms}ms")

    except Exception as exc:
        log.error(f"Job {job_id} failed: {exc}")

        # Reload retry count from DB (might have changed)
        async with async_session_factory() as session:
            r = await session.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
            fresh_job = r.scalar_one_or_none()
            retry_count = (fresh_job.retry_count if fresh_job else 0) + 1
            max_retries = fresh_job.max_retries if fresh_job else 3

        if retry_count >= max_retries:
            # Move to dead letter queue
            await queue_service.move_to_dead(job_id)
            await _update_job(
                job_id,
                status=JobStatus.FAILED,
                error_message=str(exc),
                retry_count=retry_count,
                completed_at=datetime.now(timezone.utc),
            )
            await queue_service.update_job_status(job_id, "FAILED", 0)
            await manager.broadcast_job_update(
                job_id,
                manager._make_update(job_id, "FAILED", 0, error=str(exc)),
            )
            log.warning(f"Job {job_id} moved to dead letter queue after {retry_count} retries")
        else:
            # Re-enqueue for retry
            await _update_job(
                job_id,
                status=JobStatus.QUEUED,
                error_message=str(exc),
                retry_count=retry_count,
            )
            await queue_service.enqueue(job_id, job.priority)
            await manager.broadcast_job_update(
                job_id,
                manager._make_update(job_id, "QUEUED", 0, error=f"Retrying ({retry_count}/{max_retries})"),
            )
            log.info(f"Job {job_id} re-queued for retry {retry_count}/{max_retries}")

    finally:
        await queue_service.release_lock(job_id)


async def heartbeat_loop():
    """Write worker heartbeat to Redis every 10s."""
    while True:
        await queue_service.set_worker_heartbeat(WORKER_ID)
        await asyncio.sleep(10)


async def worker_loop():
    """Main worker polling loop."""
    log.info(f"Worker {WORKER_ID} started")
    while True:
        try:
            job_id = await queue_service.dequeue()
            if not job_id:
                await asyncio.sleep(0.5)
                continue

            # Distributed lock — skip if another worker picked it up
            if not await queue_service.acquire_lock(job_id):
                log.debug(f"Job {job_id} already locked, skipping")
                continue

            # Process in background task so loop keeps polling
            asyncio.create_task(process_job(job_id))
            await asyncio.sleep(0.1)

        except Exception as exc:
            log.error(f"Worker loop error: {exc}")
            await asyncio.sleep(1)


async def main():
    await asyncio.gather(
        worker_loop(),
        heartbeat_loop(),
    )


if __name__ == "__main__":
    asyncio.run(main())
