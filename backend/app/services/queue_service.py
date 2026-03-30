import time
import uuid
from typing import Optional
from redis.asyncio import Redis
from app.config import settings

_redis_client: Optional[Redis] = None


def get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


# Queue key constants
QUEUE_JOBS = "queue:jobs"
QUEUE_RUNNING = "queue:running"
QUEUE_DEAD = "queue:dead"


def _priority_score(priority: int) -> float:
    """
    Score = (priority * 1e12) - current_timestamp_ms
    Higher priority = higher score = processed first (ZPOPMAX).
    Same priority: earlier submission processed first (lower timestamp = less subtracted).
    """
    return float(priority) * 1e12 - time.time() * 1000


async def enqueue(job_id: str, priority: int) -> None:
    r = get_redis()
    score = _priority_score(priority)
    await r.zadd(QUEUE_JOBS, {job_id: score})
    # Record queued status in Redis hash
    await r.hset(f"job:{job_id}:status", mapping={"status": "QUEUED", "progress": 0})


async def dequeue() -> Optional[str]:
    """Atomically pop highest-priority job from queue."""
    r = get_redis()
    result = await r.zpopmax(QUEUE_JOBS, count=1)
    if not result:
        return None
    job_id = result[0][0]
    await r.sadd(QUEUE_RUNNING, job_id)
    return job_id


async def acquire_lock(job_id: str, ttl: int = 300) -> bool:
    """SET NX EX — returns True if lock acquired, False if already locked."""
    r = get_redis()
    result = await r.set(f"job:{job_id}:lock", "1", nx=True, ex=ttl)
    return result is True


async def release_lock(job_id: str) -> None:
    r = get_redis()
    await r.delete(f"job:{job_id}:lock")
    await r.srem(QUEUE_RUNNING, job_id)


async def move_to_dead(job_id: str) -> None:
    """Move permanently failed job to dead letter queue."""
    r = get_redis()
    await r.zadd(QUEUE_DEAD, {job_id: time.time()})
    await r.srem(QUEUE_RUNNING, job_id)


async def cancel_job(job_id: str) -> bool:
    """If job is in queue, remove atomically. Returns True if was in queue."""
    r = get_redis()
    removed = await r.zrem(QUEUE_JOBS, job_id)
    await r.srem(QUEUE_RUNNING, job_id)
    await r.delete(f"job:{job_id}:status", f"job:{job_id}:lock")
    return removed > 0


async def update_job_status(job_id: str, status: str, progress: int = 0) -> None:
    r = get_redis()
    await r.hset(
        f"job:{job_id}:status",
        mapping={"status": status, "progress": progress},
    )


async def get_job_redis_status(job_id: str) -> Optional[dict]:
    r = get_redis()
    data = await r.hgetall(f"job:{job_id}:status")
    return data if data else None


async def get_queue_depth() -> int:
    r = get_redis()
    return await r.zcard(QUEUE_JOBS)


async def get_queue_stats() -> dict:
    r = get_redis()
    pending = await r.zcard(QUEUE_JOBS)
    running = await r.scard(QUEUE_RUNNING)
    dead = await r.zcard(QUEUE_DEAD)
    return {"pending": pending, "running": running, "dead": dead}


async def set_worker_heartbeat(worker_id: str) -> None:
    r = get_redis()
    await r.set(f"worker:{worker_id}:heartbeat", "alive", ex=30)


async def get_active_workers() -> list[str]:
    r = get_redis()
    # Scan for all worker heartbeat keys
    workers = []
    async for key in r.scan_iter("worker:*:heartbeat"):
        worker_id = key.split(":")[1]
        workers.append(worker_id)
    return workers


async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None
