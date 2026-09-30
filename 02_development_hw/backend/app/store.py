from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

from app.models import Board, BoardColumn, BoardDetail, Task, User


class ApiError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_hex, digest_hex = password_hash.split("$", maxsplit=1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return hmac.compare_digest(actual, expected)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Store:
    """Process-local data store; data and active sessions reset on restart."""

    def __init__(self, seed: bool = True):
        self.lock = RLock()
        self.users: dict[str, User] = {}
        self.password_hashes: dict[str, str] = {}
        self.boards: dict[str, Board] = {}
        self.columns: dict[str, BoardColumn] = {}
        self.tasks: dict[str, Task] = {}
        self.tokens: dict[str, str] = {}
        if seed:
            self.seed()

    @staticmethod
    def new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:12]}"

    def seed(self) -> None:
        now = utc_now()
        seeded_users = [
            User(id="u_demo", email="demo@kanban.dev", name="Demo User"),
            User(id="u_alex", email="alex@kanban.dev", name="Alex Kim"),
            User(id="u_sam", email="sam@kanban.dev", name="Sam Rivera"),
        ]
        for user in seeded_users:
            self.users[user.id] = user
            self.password_hashes[user.id] = hash_password("demo1234")

        board = Board(
            id="b_team",
            name="Team Project",
            owner_id="u_demo",
            member_ids=[user.id for user in seeded_users],
            created_at=now,
            updated_at=now,
        )
        self.boards[board.id] = board
        columns = [
            BoardColumn(id=f"c_{index}", board_id=board.id, name=name, position=index)
            for index, name in enumerate(["To Do", "In Progress", "Review", "Done"])
        ]
        self.columns.update({column.id: column for column in columns})
        tasks = [
            ("Fix login redirect", 0, "u_alex", "high"),
            ("Write onboarding copy", 0, None, "low"),
            ("Build tasks API", 1, "u_demo", "medium"),
            ("Review column rules", 2, "u_sam", "medium"),
            ("Set up repository", 3, "u_demo", None),
        ]
        positions: dict[str, int] = {}
        for title, column_index, assignee_id, priority in tasks:
            column = columns[column_index]
            position = positions.get(column.id, 0)
            positions[column.id] = position + 1
            task = Task(
                id=self.new_id("t"),
                board_id=board.id,
                column_id=column.id,
                title=title,
                description="",
                assignee_id=assignee_id,
                priority=priority,
                position=position,
                created_at=now,
                updated_at=now,
            )
            self.tasks[task.id] = task

    def create_user(self, email: str, password: str, name: str) -> User:
        normalized_email = email.strip().lower()
        with self.lock:
            if any(user.email == normalized_email for user in self.users.values()):
                raise ApiError(409, "Email already registered")
            user = User(id=self.new_id("u"), email=normalized_email, name=name.strip())
            self.users[user.id] = user
            self.password_hashes[user.id] = hash_password(password)
            return user

    def authenticate(self, email: str, password: str) -> User:
        normalized_email = email.strip().lower()
        with self.lock:
            user = next((u for u in self.users.values() if u.email == normalized_email), None)
            if user is None or not verify_password(password, self.password_hashes[user.id]):
                raise ApiError(401, "Invalid email or password")
            return user

    def issue_token(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        with self.lock:
            self.tokens[token] = user_id
        return token

    def user_for_token(self, token: str | None) -> User | None:
        if not token:
            return None
        with self.lock:
            user_id = self.tokens.get(token)
            return self.users.get(user_id) if user_id else None

    def revoke_token(self, token: str | None) -> None:
        if token:
            with self.lock:
                self.tokens.pop(token, None)

    def require_board(self, user: User, board_id: str) -> Board:
        board = self.boards.get(board_id)
        if board is None or user.id not in board.member_ids:
            raise ApiError(404, "Board not found")
        return board

    def require_owner(self, user: User, board_id: str) -> Board:
        board = self.require_board(user, board_id)
        if board.owner_id != user.id:
            raise ApiError(403, "Only the board owner can do that")
        return board

    def require_column(self, user: User, column_id: str) -> tuple[BoardColumn, Board]:
        column = self.columns.get(column_id)
        if column is None:
            raise ApiError(404, "Column not found")
        return column, self.require_board(user, column.board_id)

    def require_task(self, user: User, task_id: str) -> tuple[Task, Board]:
        task = self.tasks.get(task_id)
        if task is None:
            raise ApiError(404, "Task not found")
        return task, self.require_board(user, task.board_id)

    def list_boards(self, user: User) -> list[Board]:
        return sorted(
            (b for b in self.boards.values() if user.id in b.member_ids),
            key=lambda board: board.created_at,
        )

    def board_detail(self, user: User, board_id: str) -> BoardDetail:
        board = self.require_board(user, board_id)
        columns = sorted(
            (c for c in self.columns.values() if c.board_id == board_id),
            key=lambda column: column.position,
        )
        tasks = sorted(
            (t for t in self.tasks.values() if t.board_id == board_id),
            key=lambda task: (task.column_id, task.position),
        )
        members = [self.users[member_id] for member_id in board.member_ids if member_id in self.users]
        return BoardDetail(board=board, columns=columns, tasks=tasks, members=members)

    def create_board(self, user: User, name: str) -> Board:
        name = name.strip()
        if not name:
            raise ApiError(422, "Board name is required")
        now = utc_now()
        board = Board(
            id=self.new_id("b"),
            name=name,
            owner_id=user.id,
            member_ids=[user.id],
            created_at=now,
            updated_at=now,
        )
        self.boards[board.id] = board
        for position, column_name in enumerate(["To Do", "In Progress", "Done"]):
            column = BoardColumn(
                id=self.new_id("c"), board_id=board.id, name=column_name, position=position
            )
            self.columns[column.id] = column
        return board

    def rename_board(self, user: User, board_id: str, name: str) -> Board:
        board = self.require_owner(user, board_id)
        name = name.strip()
        if not name:
            raise ApiError(422, "Board name is required")
        board.name = name
        board.updated_at = utc_now()
        return board

    def delete_board(self, user: User, board_id: str) -> None:
        self.require_owner(user, board_id)
        del self.boards[board_id]
        self.columns = {key: value for key, value in self.columns.items() if value.board_id != board_id}
        self.tasks = {key: value for key, value in self.tasks.items() if value.board_id != board_id}

    def add_member(self, user: User, board_id: str, email: str) -> User:
        board = self.require_owner(user, board_id)
        normalized_email = email.strip().lower()
        member = next((u for u in self.users.values() if u.email == normalized_email), None)
        if member is None:
            raise ApiError(404, "No user with that email")
        if member.id in board.member_ids:
            raise ApiError(409, "Already a member")
        board.member_ids.append(member.id)
        board.updated_at = utc_now()
        return member

    def remove_member(self, user: User, board_id: str, user_id: str) -> None:
        board = self.require_owner(user, board_id)
        if user_id == board.owner_id:
            raise ApiError(403, "The owner cannot be removed")
        if user_id not in board.member_ids:
            raise ApiError(404, "Member not found")
        board.member_ids.remove(user_id)
        for task in self.tasks.values():
            if task.board_id == board_id and task.assignee_id == user_id:
                task.assignee_id = None
        board.updated_at = utc_now()

    def create_column(self, user: User, board_id: str, name: str) -> BoardColumn:
        self.require_owner(user, board_id)
        name = name.strip()
        if not name:
            raise ApiError(422, "Column name is required")
        position = sum(column.board_id == board_id for column in self.columns.values())
        column = BoardColumn(id=self.new_id("c"), board_id=board_id, name=name, position=position)
        self.columns[column.id] = column
        return column

    def rename_column(self, user: User, column_id: str, name: str) -> BoardColumn:
        column, _ = self.require_column(user, column_id)
        self.require_owner(user, column.board_id)
        name = name.strip()
        if not name:
            raise ApiError(422, "Column name is required")
        column.name = name
        return column

    def delete_column(self, user: User, column_id: str) -> None:
        column, _ = self.require_column(user, column_id)
        self.require_owner(user, column.board_id)
        if any(task.column_id == column_id for task in self.tasks.values()):
            raise ApiError(409, "Move or delete this column's tasks first")
        del self.columns[column_id]
        remaining = sorted(
            (c for c in self.columns.values() if c.board_id == column.board_id),
            key=lambda c: c.position,
        )
        for position, item in enumerate(remaining):
            item.position = position

    def reorder_columns(self, user: User, board_id: str, ordered_ids: list[str]) -> list[BoardColumn]:
        self.require_owner(user, board_id)
        columns = [column for column in self.columns.values() if column.board_id == board_id]
        current_ids = {column.id for column in columns}
        if len(ordered_ids) != len(columns) or set(ordered_ids) != current_ids:
            raise ApiError(422, "Invalid column order")
        by_id = {column.id: column for column in columns}
        for position, column_id in enumerate(ordered_ids):
            by_id[column_id].position = position
        return [by_id[column_id] for column_id in ordered_ids]

    def validate_assignee(self, board: Board, assignee_id: str | None) -> None:
        if assignee_id is not None and assignee_id not in board.member_ids:
            raise ApiError(422, "Assignee must be a board member")

    def create_task(self, user: User, board_id: str, data: dict) -> Task:
        board = self.require_board(user, board_id)
        column = self.columns.get(data["column_id"])
        if column is None or column.board_id != board_id:
            raise ApiError(422, "Column not on this board")
        self.validate_assignee(board, data.get("assignee_id"))
        position = sum(task.column_id == column.id for task in self.tasks.values())
        now = utc_now()
        task = Task(
            id=self.new_id("t"),
            board_id=board_id,
            column_id=column.id,
            title=data["title"].strip(),
            description=data.get("description") or "",
            assignee_id=data.get("assignee_id"),
            priority=data.get("priority"),
            due_date=data.get("due_date"),
            position=position,
            created_at=now,
            updated_at=now,
        )
        if not task.title:
            raise ApiError(422, "Title is required")
        self.tasks[task.id] = task
        return task

    def update_task(self, user: User, task_id: str, values: dict) -> Task:
        task, board = self.require_task(user, task_id)
        values.pop("column_id", None)
        if "title" in values:
            title = values["title"].strip()
            if not title:
                raise ApiError(422, "Title is required")
            task.title = title
        if "description" in values and values["description"] is not None:
            task.description = values["description"]
        if "assignee_id" in values:
            self.validate_assignee(board, values["assignee_id"])
            task.assignee_id = values["assignee_id"]
        if "priority" in values:
            task.priority = values["priority"]
        if "due_date" in values:
            task.due_date = values["due_date"]
        task.updated_at = utc_now()
        return task

    def renumber_tasks(self, column_id: str) -> None:
        siblings = sorted(
            (task for task in self.tasks.values() if task.column_id == column_id),
            key=lambda task: task.position,
        )
        for position, task in enumerate(siblings):
            task.position = position

    def delete_task(self, user: User, task_id: str) -> None:
        task, _ = self.require_task(user, task_id)
        del self.tasks[task_id]
        self.renumber_tasks(task.column_id)

    def move_task(self, user: User, task_id: str, column_id: str, position: int) -> Task:
        task, board = self.require_task(user, task_id)
        column = self.columns.get(column_id)
        if column is None or column.board_id != board.id:
            raise ApiError(422, "Column not on this board")
        source_column_id = task.column_id
        siblings = sorted(
            (
                sibling
                for sibling in self.tasks.values()
                if sibling.column_id == column_id and sibling.id != task_id
            ),
            key=lambda sibling: sibling.position,
        )
        target_position = max(0, min(position, len(siblings)))
        siblings.insert(target_position, task)
        task.column_id = column_id
        for index, sibling in enumerate(siblings):
            sibling.position = index
        if source_column_id != column_id:
            self.renumber_tasks(source_column_id)
        task.updated_at = utc_now()
        return task


store = Store(seed=True)
