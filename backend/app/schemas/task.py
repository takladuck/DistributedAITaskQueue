import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel
from app.models.task import TaskType


class TaskCreate(BaseModel):
    name: str
    description: str | None = None
    task_type: TaskType
    payload: dict[str, Any] = {}


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    payload: dict[str, Any] | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None
    task_type: TaskType
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    per_page: int
    total_pages: int
