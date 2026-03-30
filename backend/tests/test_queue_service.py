import pytest
import time
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_redis():
    """In-memory mock of Redis operations for queue service."""
    sorted_set = {}  # job_id -> score
    running_set = set()
    dead_set = {}
    locks = {}
    hashes = {}

    redis = MagicMock()

    async def zadd(key, mapping):
        for k, v in mapping.items():
            sorted_set[k] = v
        return len(mapping)

    async def zpopmax(key, count=1):
        if not sorted_set:
            return []
        top = sorted(sorted_set.items(), key=lambda x: x[1], reverse=True)[:count]
        for job_id, _ in top:
            del sorted_set[job_id]
        return top

    async def zcard(key):
        if "running" in key:
            return len(running_set)
        if "dead" in key:
            return len(dead_set)
        return len(sorted_set)

    async def zrem(key, member):
        if member in sorted_set:
            del sorted_set[member]
            return 1
        return 0

    async def sadd(key, member):
        running_set.add(member)

    async def srem(key, member):
        running_set.discard(member)

    async def scard(key):
        return len(running_set)

    async def set(key, value, nx=False, ex=None):
        if nx and key in locks:
            return None  # lock already held
        locks[key] = value
        return True

    async def delete(*keys):
        for key in keys:
            locks.pop(key, None)
            hashes.pop(key, None)

    async def hset(key, mapping=None, **kwargs):
        if mapping:
            hashes[key] = mapping
        hashes[key] = {**hashes.get(key, {}), **kwargs}

    async def hgetall(key):
        return hashes.get(key, {})

    async def ping():
        return True

    async def scan_iter(pattern):
        # yield nothing for simplicity
        return
        yield  # make it an async generator

    redis.zadd = zadd
    redis.zpopmax = zpopmax
    redis.zcard = zcard
    redis.zrem = zrem
    redis.sadd = sadd
    redis.srem = srem
    redis.scard = scard
    redis.set = set
    redis.delete = delete
    redis.hset = hset
    redis.hgetall = hgetall
    redis.ping = ping
    redis.scan_iter = scan_iter
    return redis, sorted_set, running_set, locks


@pytest.mark.asyncio
async def test_enqueue_adds_to_sorted_set(mock_redis):
    redis_mock, sorted_set, _, _ = mock_redis
    with patch("app.services.queue_service.get_redis", return_value=redis_mock):
        from app.services.queue_service import enqueue
        await enqueue("job-abc", priority=7)
        assert "job-abc" in sorted_set
        # Score should be 7 * 1e12 minus a small timestamp
        score = sorted_set["job-abc"]
        assert score > 6e12
        assert score < 8e12


@pytest.mark.asyncio
async def test_dequeue_returns_highest_priority(mock_redis):
    redis_mock, sorted_set, running_set, _ = mock_redis
    with patch("app.services.queue_service.get_redis", return_value=redis_mock):
        from app.services.queue_service import enqueue, dequeue
        await enqueue("low-priority", priority=2)
        await enqueue("high-priority", priority=9)
        job_id = await dequeue()
        assert job_id == "high-priority"
        assert "high-priority" in running_set


@pytest.mark.asyncio
async def test_dequeue_empty_returns_none(mock_redis):
    redis_mock, _, _, _ = mock_redis
    with patch("app.services.queue_service.get_redis", return_value=redis_mock):
        from app.services.queue_service import dequeue
        result = await dequeue()
        assert result is None


@pytest.mark.asyncio
async def test_lock_prevents_double_acquisition(mock_redis):
    redis_mock, _, _, locks = mock_redis
    with patch("app.services.queue_service.get_redis", return_value=redis_mock):
        from app.services.queue_service import acquire_lock
        first = await acquire_lock("job-xyz")
        second = await acquire_lock("job-xyz")
        assert first is True
        assert second is False


@pytest.mark.asyncio
async def test_release_lock_removes_lock(mock_redis):
    redis_mock, _, running_set, locks = mock_redis
    with patch("app.services.queue_service.get_redis", return_value=redis_mock):
        from app.services.queue_service import acquire_lock, release_lock
        await acquire_lock("job-release")
        running_set.add("job-release")
        await release_lock("job-release")
        assert "job:job-release:lock" not in locks
        assert "job-release" not in running_set


@pytest.mark.asyncio
async def test_move_to_dead_queue(mock_redis):
    redis_mock, sorted_set, running_set, _ = mock_redis
    dead_set = {}

    async def zadd_override(key, mapping):
        if "dead" in key:
            dead_set.update(mapping)
        else:
            sorted_set.update(mapping)

    redis_mock.zadd = zadd_override
    running_set.add("dead-job")

    with patch("app.services.queue_service.get_redis", return_value=redis_mock):
        from app.services.queue_service import move_to_dead
        await move_to_dead("dead-job")
        assert "dead-job" in dead_set
        assert "dead-job" not in running_set


@pytest.mark.asyncio
async def test_get_queue_stats(mock_redis):
    redis_mock, sorted_set, running_set, _ = mock_redis
    sorted_set["j1"] = 9e12
    sorted_set["j2"] = 8e12
    running_set.add("j3")

    with patch("app.services.queue_service.get_redis", return_value=redis_mock):
        from app.services.queue_service import get_queue_stats
        stats = await get_queue_stats()
        assert stats["pending"] == 2
        assert stats["running"] == 1
        assert stats["dead"] == 0
