import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, Enum, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TaskType(str, enum.Enum):
    TEXT_SUMMARIZE = "TEXT_SUMMARIZE"
    SENTIMENT_ANALYSIS = "SENTIMENT_ANALYSIS"
    CODE_REVIEW = "CODE_REVIEW"
    DATA_EXTRACTION = "DATA_EXTRACTION"
    CUSTOM = "CUSTOM"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[TaskType] = mapped_column(
        Enum(TaskType, name="task_type_enum"), nullable=False
    )
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_deleted: Mapped[bool] = mapped_column(default=False)

    user = relationship("User", back_populates="tasks")
    jobs = relationship("Job", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Task {self.name} ({self.task_type})>"
