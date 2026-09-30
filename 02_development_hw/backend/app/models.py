from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class User(ApiModel):
    id: str
    email: str
    name: str


class Board(ApiModel):
    id: str
    name: str
    owner_id: str
    member_ids: list[str]
    created_at: datetime
    updated_at: datetime


class BoardColumn(ApiModel):
    id: str
    board_id: str
    name: str
    position: int = Field(ge=0)


class Task(ApiModel):
    id: str
    board_id: str
    column_id: str
    title: str
    description: str = ""
    assignee_id: str | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: date | None = None
    position: int = Field(ge=0)
    created_at: datetime
    updated_at: datetime


class BoardDetail(ApiModel):
    board: Board
    columns: list[BoardColumn]
    tasks: list[Task]
    members: list[User]


class Credentials(ApiModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RegisterInput(Credentials):
    name: str = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value


class NameInput(ApiModel):
    name: str = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value


class MemberInput(ApiModel):
    email: EmailStr


class ColumnOrderInput(ApiModel):
    ordered_column_ids: list[str]


class TaskCreateInput(ApiModel):
    title: str = Field(min_length=1)
    description: str = ""
    column_id: str
    assignee_id: str | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title must not be blank")
        return value


class TaskUpdateInput(ApiModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    column_id: str | None = None
    assignee_id: str | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Title must not be blank")
        return value


class TaskMoveInput(ApiModel):
    to_column_id: str
    to_position: int


class ErrorResponse(ApiModel):
    message: str
