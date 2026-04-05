from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
import ssl

# Create SSL context for Supabase (requires SSL from external connections)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={
        "ssl": ssl_context,
        "server_settings": {"jit": "off"},  # Supabase free tier compatibility
    },
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create tables, with retry logic for cloud DB cold starts."""
    import asyncio
    import logging
    log = logging.getLogger(__name__)

    for attempt in range(1, 6):
        try:
            async with engine.begin() as conn:
                from app.models import User, Task, Job  # noqa: F401
                await conn.run_sync(Base.metadata.create_all)
            log.info("Database initialized successfully")
            return
        except Exception as e:
            log.warning(f"DB init attempt {attempt}/5 failed: {e}")
            if attempt < 5:
                await asyncio.sleep(attempt * 2)  # 2s, 4s, 6s, 8s
            else:
                raise
