from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.database import init_db
from app.services.queue_service import get_redis, close_redis
from app.routers import auth, tasks, jobs, metrics, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    # Warm up Redis connection
    r = get_redis()
    await r.ping()
    yield
    # Shutdown
    await close_redis()


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Distributed AI Task Queue",
    description="Production-grade distributed task queue with AI integration",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(jobs.router)
app.include_router(metrics.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    from app.services.queue_service import get_redis as _get_redis
    from sqlalchemy import text
    from app.database import async_session_factory

    db_ok = False
    redis_ok = False

    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    try:
        r = _get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if (db_ok and redis_ok) else "degraded",
        "db": "ok" if db_ok else "error",
        "redis": "ok" if redis_ok else "error",
    }


@app.get("/")
async def root():
    return {"message": "Distributed AI Task Queue API", "version": "1.0.0"}
