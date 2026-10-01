from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import (
    Base,
    BoardMemberRow,
    BoardRow,
    ColumnRow,
    SessionRow,
    TaskRow,
    UserRow,
    create_database_engine,
    create_session_factory,
)
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


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class Store:
    """SQLAlchemy-backed application store."""

    def __init__(self, database_url: str | None = None, seed: bool = True):
        self.engine = create_database_engine(database_url)
        self.Session = create_session_factory(self.engine)
        Base.metadata.create_all(self.engine)
        if seed:
            self.seed()

    @staticmethod
    def new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:12]}"

    @staticmethod
    def user_schema(row: UserRow) -> User:
        return User(id=row.id, email=row.email, name=row.name)

    @staticmethod
    def board_schema(session: Session, row: BoardRow) -> Board:
        member_ids = session.scalars(
            select(BoardMemberRow.user_id)
            .where(BoardMemberRow.board_id == row.id)
            .order_by(BoardMemberRow.position)
        ).all()
        return Board(
            id=row.id,
            name=row.name,
            owner_id=row.owner_id,
            member_ids=list(member_ids),
            created_at=_as_utc(row.created_at),
            updated_at=_as_utc(row.updated_at),
        )

    @staticmethod
    def column_schema(row: ColumnRow) -> BoardColumn:
        return BoardColumn(
            id=row.id,
            board_id=row.board_id,
            name=row.name,
            position=row.position,
        )

    @staticmethod
    def task_schema(row: TaskRow) -> Task:
        return Task(
            id=row.id,
            board_id=row.board_id,
            column_id=row.column_id,
            title=row.title,
            description=row.description,
            assignee_id=row.assignee_id,
            priority=row.priority,
            due_date=row.due_date,
            position=row.position,
            created_at=_as_utc(row.created_at),
            updated_at=_as_utc(row.updated_at),
        )

    def seed(self) -> None:
        with self.Session.begin() as session:
            seeded_users = [
                ("u_demo", "demo@kanban.dev", "Demo User"),
                ("u_alex", "alex@kanban.dev", "Alex Kim"),
                ("u_sam", "sam@kanban.dev", "Sam Rivera"),
            ]
            for user_id, email, name in seeded_users:
                if session.get(UserRow, user_id) is None:
                    session.add(
                        UserRow(
                            id=user_id,
                            email=email,
                            name=name,
                            password_hash=hash_password("demo1234"),
                        )
                    )
            if session.get(BoardRow, "b_team") is not None:
                return

            now = utc_now()
            board = BoardRow(
                id="b_team",
                name="Team Project",
                owner_id="u_demo",
                created_at=now,
                updated_at=now,
            )
            session.add(board)
            session.flush()
            for position, (user_id, _, _) in enumerate(seeded_users):
                session.add(BoardMemberRow(board_id=board.id, user_id=user_id, position=position))

            columns = [
                ColumnRow(id=f"c_{index}", board_id=board.id, name=name, position=index)
                for index, name in enumerate(["To Do", "In Progress", "Review", "Done"])
            ]
            session.add_all(columns)
            session.flush()
            seeded_tasks = [
                ("Fix login redirect", 0, "u_alex", "high"),
                ("Write onboarding copy", 0, None, "low"),
                ("Build tasks API", 1, "u_demo", "medium"),
                ("Review column rules", 2, "u_sam", "medium"),
                ("Set up repository", 3, "u_demo", None),
            ]
            positions: dict[str, int] = {}
            for title, column_index, assignee_id, priority in seeded_tasks:
                column = columns[column_index]
                position = positions.get(column.id, 0)
                positions[column.id] = position + 1
                session.add(
                    TaskRow(
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
                )

    def password_hash_for(self, user_id: str) -> str:
        with self.Session() as session:
            user = session.get(UserRow, user_id)
            if user is None:
                raise KeyError(user_id)
            return user.password_hash

    def create_user(self, email: str, password: str, name: str) -> User:
        normalized_email = email.strip().lower()
        row = UserRow(
            id=self.new_id("u"),
            email=normalized_email,
            name=name.strip(),
            password_hash=hash_password(password),
        )
        try:
            with self.Session.begin() as session:
                if session.scalar(select(UserRow.id).where(UserRow.email == normalized_email)):
                    raise ApiError(409, "Email already registered")
                session.add(row)
                session.flush()
                return self.user_schema(row)
        except IntegrityError as exc:
            raise ApiError(409, "Email already registered") from exc

    def authenticate(self, email: str, password: str) -> User:
        normalized_email = email.strip().lower()
        with self.Session() as session:
            row = session.scalar(select(UserRow).where(UserRow.email == normalized_email))
            if row is None or not verify_password(password, row.password_hash):
                raise ApiError(401, "Invalid email or password")
            return self.user_schema(row)

    def issue_token(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        with self.Session.begin() as session:
            if session.get(UserRow, user_id) is None:
                raise ApiError(401, "Missing or invalid authentication")
            session.add(SessionRow(token=token, user_id=user_id))
        return token

    def user_for_token(self, token: str | None) -> User | None:
        if not token:
            return None
        with self.Session() as session:
            row = session.scalar(
                select(UserRow)
                .join(SessionRow, SessionRow.user_id == UserRow.id)
                .where(SessionRow.token == token)
            )
            return self.user_schema(row) if row is not None else None

    def revoke_token(self, token: str | None) -> None:
        if token:
            with self.Session.begin() as session:
                session.execute(delete(SessionRow).where(SessionRow.token == token))

    def require_board(self, session: Session, user: User, board_id: str) -> BoardRow:
        board = session.get(BoardRow, board_id)
        membership = session.get(BoardMemberRow, (board_id, user.id))
        if board is None or membership is None:
            raise ApiError(404, "Board not found")
        return board

    def require_owner(self, session: Session, user: User, board_id: str) -> BoardRow:
        board = self.require_board(session, user, board_id)
        if board.owner_id != user.id:
            raise ApiError(403, "Only the board owner can do that")
        return board

    def require_column(self, session: Session, user: User, column_id: str) -> tuple[ColumnRow, BoardRow]:
        column = session.get(ColumnRow, column_id)
        if column is None:
            raise ApiError(404, "Column not found")
        board = self.require_board(session, user, column.board_id)
        return column, board

    def require_task(self, session: Session, user: User, task_id: str) -> tuple[TaskRow, BoardRow]:
        task = session.get(TaskRow, task_id)
        if task is None:
            raise ApiError(404, "Task not found")
        board = self.require_board(session, user, task.board_id)
        return task, board

    def list_users(self) -> list[User]:
        with self.Session() as session:
            return [
                self.user_schema(row)
                for row in session.scalars(select(UserRow).order_by(UserRow.id))
            ]

    def list_boards(self, user: User) -> list[Board]:
        with self.Session() as session:
            rows = session.scalars(
                select(BoardRow)
                .join(BoardMemberRow, BoardMemberRow.board_id == BoardRow.id)
                .where(BoardMemberRow.user_id == user.id)
                .order_by(BoardRow.created_at)
            )
            return [self.board_schema(session, row) for row in rows]

    def board_detail(self, user: User, board_id: str) -> BoardDetail:
        with self.Session() as session:
            board = self.require_board(session, user, board_id)
            columns = session.scalars(
                select(ColumnRow)
                .where(ColumnRow.board_id == board_id)
                .order_by(ColumnRow.position)
            ).all()
            tasks = session.scalars(
                select(TaskRow)
                .where(TaskRow.board_id == board_id)
                .order_by(TaskRow.column_id, TaskRow.position)
            ).all()
            members = session.scalars(
                select(UserRow)
                .join(BoardMemberRow, BoardMemberRow.user_id == UserRow.id)
                .where(BoardMemberRow.board_id == board_id)
                .order_by(BoardMemberRow.position)
            ).all()
            return BoardDetail(
                board=self.board_schema(session, board),
                columns=[self.column_schema(row) for row in columns],
                tasks=[self.task_schema(row) for row in tasks],
                members=[self.user_schema(row) for row in members],
            )

    def create_board(self, user: User, name: str) -> Board:
        name = name.strip()
        if not name:
            raise ApiError(422, "Board name is required")
        now = utc_now()
        row = BoardRow(
            id=self.new_id("b"),
            name=name,
            owner_id=user.id,
            created_at=now,
            updated_at=now,
        )
        with self.Session.begin() as session:
            session.add(row)
            session.flush()
            session.add(BoardMemberRow(board_id=row.id, user_id=user.id, position=0))
            session.add_all(
                ColumnRow(
                    id=self.new_id("c"),
                    board_id=row.id,
                    name=column_name,
                    position=position,
                )
                for position, column_name in enumerate(["To Do", "In Progress", "Done"])
            )
            result = self.board_schema(session, row)
        return result

    def rename_board(self, user: User, board_id: str, name: str) -> Board:
        name = name.strip()
        if not name:
            raise ApiError(422, "Board name is required")
        with self.Session.begin() as session:
            board = self.require_owner(session, user, board_id)
            board.name = name
            board.updated_at = utc_now()
            return self.board_schema(session, board)

    def delete_board(self, user: User, board_id: str) -> None:
        with self.Session.begin() as session:
            board = self.require_owner(session, user, board_id)
            session.execute(delete(TaskRow).where(TaskRow.board_id == board_id))
            session.execute(delete(ColumnRow).where(ColumnRow.board_id == board_id))
            session.execute(delete(BoardMemberRow).where(BoardMemberRow.board_id == board_id))
            session.delete(board)

    def add_member(self, user: User, board_id: str, email: str) -> User:
        normalized_email = email.strip().lower()
        with self.Session.begin() as session:
            board = self.require_owner(session, user, board_id)
            member = session.scalar(select(UserRow).where(UserRow.email == normalized_email))
            if member is None:
                raise ApiError(404, "No user with that email")
            if session.get(BoardMemberRow, (board_id, member.id)) is not None:
                raise ApiError(409, "Already a member")
            position = session.scalar(
                select(func.count()).select_from(BoardMemberRow).where(
                    BoardMemberRow.board_id == board_id
                )
            )
            session.add(
                BoardMemberRow(board_id=board_id, user_id=member.id, position=position or 0)
            )
            board.updated_at = utc_now()
            return self.user_schema(member)

    def remove_member(self, user: User, board_id: str, user_id: str) -> None:
        with self.Session.begin() as session:
            board = self.require_owner(session, user, board_id)
            if user_id == board.owner_id:
                raise ApiError(403, "The owner cannot be removed")
            membership = session.get(BoardMemberRow, (board_id, user_id))
            if membership is None:
                raise ApiError(404, "Member not found")
            for task in session.scalars(
                select(TaskRow).where(TaskRow.board_id == board_id, TaskRow.assignee_id == user_id)
            ):
                task.assignee_id = None
            session.delete(membership)
            board.updated_at = utc_now()

    def create_column(self, user: User, board_id: str, name: str) -> BoardColumn:
        name = name.strip()
        if not name:
            raise ApiError(422, "Column name is required")
        with self.Session.begin() as session:
            self.require_owner(session, user, board_id)
            position = session.scalar(
                select(func.count()).select_from(ColumnRow).where(ColumnRow.board_id == board_id)
            )
            row = ColumnRow(
                id=self.new_id("c"),
                board_id=board_id,
                name=name,
                position=position or 0,
            )
            session.add(row)
            return self.column_schema(row)

    def rename_column(self, user: User, column_id: str, name: str) -> BoardColumn:
        name = name.strip()
        if not name:
            raise ApiError(422, "Column name is required")
        with self.Session.begin() as session:
            column, _ = self.require_column(session, user, column_id)
            self.require_owner(session, user, column.board_id)
            column.name = name
            return self.column_schema(column)

    def delete_column(self, user: User, column_id: str) -> None:
        with self.Session.begin() as session:
            column, _ = self.require_column(session, user, column_id)
            self.require_owner(session, user, column.board_id)
            if session.scalar(select(TaskRow.id).where(TaskRow.column_id == column_id)):
                raise ApiError(409, "Move or delete this column's tasks first")
            board_id = column.board_id
            session.delete(column)
            remaining = session.scalars(
                select(ColumnRow)
                .where(ColumnRow.board_id == board_id, ColumnRow.id != column_id)
                .order_by(ColumnRow.position)
            ).all()
            for position, item in enumerate(remaining):
                item.position = position

    def reorder_columns(self, user: User, board_id: str, ordered_ids: list[str]) -> list[BoardColumn]:
        with self.Session.begin() as session:
            self.require_owner(session, user, board_id)
            columns = session.scalars(
                select(ColumnRow).where(ColumnRow.board_id == board_id)
            ).all()
            current_ids = {column.id for column in columns}
            if len(ordered_ids) != len(columns) or set(ordered_ids) != current_ids:
                raise ApiError(422, "Invalid column order")
            by_id = {column.id: column for column in columns}
            for position, column_id in enumerate(ordered_ids):
                by_id[column_id].position = position
            return [self.column_schema(by_id[column_id]) for column_id in ordered_ids]

    def validate_assignee(self, session: Session, board_id: str, assignee_id: str | None) -> None:
        if assignee_id is not None and session.get(
            BoardMemberRow, (board_id, assignee_id)
        ) is None:
            raise ApiError(422, "Assignee must be a board member")

    def create_task(self, user: User, board_id: str, data: dict) -> Task:
        with self.Session.begin() as session:
            self.require_board(session, user, board_id)
            column = session.get(ColumnRow, data["column_id"])
            if column is None or column.board_id != board_id:
                raise ApiError(422, "Column not on this board")
            self.validate_assignee(session, board_id, data.get("assignee_id"))
            position = session.scalar(
                select(func.count()).select_from(TaskRow).where(TaskRow.column_id == column.id)
            )
            title = data["title"].strip()
            if not title:
                raise ApiError(422, "Title is required")
            now = utc_now()
            row = TaskRow(
                id=self.new_id("t"),
                board_id=board_id,
                column_id=column.id,
                title=title,
                description=data.get("description") or "",
                assignee_id=data.get("assignee_id"),
                priority=data.get("priority"),
                due_date=data.get("due_date"),
                position=position or 0,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            return self.task_schema(row)

    def update_task(self, user: User, task_id: str, values: dict) -> Task:
        values.pop("column_id", None)
        with self.Session.begin() as session:
            task, board = self.require_task(session, user, task_id)
            if "title" in values:
                title = values["title"].strip()
                if not title:
                    raise ApiError(422, "Title is required")
                task.title = title
            if "description" in values and values["description"] is not None:
                task.description = values["description"]
            if "assignee_id" in values:
                self.validate_assignee(session, board.id, values["assignee_id"])
                task.assignee_id = values["assignee_id"]
            if "priority" in values:
                task.priority = values["priority"]
            if "due_date" in values:
                task.due_date = values["due_date"]
            task.updated_at = utc_now()
            return self.task_schema(task)

    @staticmethod
    def renumber_tasks(session: Session, column_id: str) -> None:
        siblings = session.scalars(
            select(TaskRow).where(TaskRow.column_id == column_id).order_by(TaskRow.position)
        ).all()
        for position, task in enumerate(siblings):
            task.position = position

    def delete_task(self, user: User, task_id: str) -> None:
        with self.Session.begin() as session:
            task, _ = self.require_task(session, user, task_id)
            column_id = task.column_id
            session.delete(task)
            session.flush()
            self.renumber_tasks(session, column_id)

    def move_task(self, user: User, task_id: str, column_id: str, position: int) -> Task:
        with self.Session.begin() as session:
            task, board = self.require_task(session, user, task_id)
            column = session.get(ColumnRow, column_id)
            if column is None or column.board_id != board.id:
                raise ApiError(422, "Column not on this board")
            source_column_id = task.column_id
            siblings = session.scalars(
                select(TaskRow)
                .where(TaskRow.column_id == column_id, TaskRow.id != task_id)
                .order_by(TaskRow.position)
            ).all()
            target_position = max(0, min(position, len(siblings)))
            siblings.insert(target_position, task)
            task.column_id = column_id
            for index, sibling in enumerate(siblings):
                sibling.position = index
            if source_column_id != column_id:
                self.renumber_tasks(session, source_column_id)
            task.updated_at = utc_now()
            return self.task_schema(task)


store = Store(seed=True)
