import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field
from app.models.job import JobStatus


class JobSubmit(BaseModel):
    task_id: uuid.UUID
    priority: int = Field(default=5, ge=1, le=10)


class JobResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    status: JobStatus
    priority: int
    retry_count: int
    max_retries: int
    result: dict[str, Any] | None
    error_message: str | None
    queued_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    execution_time_ms: int | None

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class JobStatusUpdate(BaseModel):
    event: str
    job_id: str
    status: JobStatus
    progress: int = 0
    result: dict[str, Any] | None = None
    error: str | None = None
    timestamp: str
