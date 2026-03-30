import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.database import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])

PER_PAGE = 20


def _get_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    return auth[7:] if auth.startswith("Bearer ") else ""


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)
    task = Task(
        id=uuid.uuid4(),
        user_id=user.id,
        name=payload.name,
        description=payload.description,
        task_type=payload.task_type,
        payload=payload.payload,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    request: Request,
    page: int = 1,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)

    offset = (page - 1) * PER_PAGE
    count_q = await db.execute(
        select(func.count()).where(
            and_(Task.user_id == user.id, Task.is_deleted == False)
        )
    )
    total = count_q.scalar_one()
    result = await db.execute(
        select(Task)
        .where(and_(Task.user_id == user.id, Task.is_deleted == False))
        .order_by(Task.created_at.desc())
        .offset(offset)
        .limit(PER_PAGE)
    )
    tasks = result.scalars().all()
    return TaskListResponse(
        items=[TaskResponse.model_validate(t) for t in tasks],
        total=total,
        page=page,
        per_page=PER_PAGE,
        total_pages=math.ceil(total / PER_PAGE) if total else 1,
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)
    result = await db.execute(
        select(Task).where(and_(Task.id == task_id, Task.user_id == user.id, Task.is_deleted == False))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)
    result = await db.execute(
        select(Task).where(and_(Task.id == task_id, Task.user_id == user.id, Task.is_deleted == False))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if payload.name is not None:
        task.name = payload.name
    if payload.description is not None:
        task.description = payload.description
    if payload.payload is not None:
        task.payload = payload.payload
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = _get_token(request)
    user: User = await get_current_user(token, db)
    result = await db.execute(
        select(Task).where(and_(Task.id == task_id, Task.user_id == user.id, Task.is_deleted == False))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_deleted = True
    db.add(task)
