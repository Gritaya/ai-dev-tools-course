# Mini Kanban Board — Architecture

## Selected stack

The MVP will use a separated React frontend and FastAPI backend:

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Drag and drop | `@dnd-kit/core` |
| Backend | Python FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy 2 |
| Database migrations | Alembic |
| API validation and settings | Pydantic |
| Authentication | JWT access tokens with HTTP-only cookies |
| API documentation | FastAPI-generated OpenAPI |
| Deployment | Render, Railway, or Fly.io |

## Architectural approach

The application consists of two independently deployable services:

```text
React/Vite frontend
        │ HTTPS/JSON REST API
        ▼
FastAPI backend
        │ SQLAlchemy
        ▼
PostgreSQL
```

The frontend is responsible for rendering boards, handling forms, and managing drag-and-drop interactions. The backend owns authentication, authorization, business rules, validation, and persistence. PostgreSQL is the source of truth for users, boards, membership, columns, and tasks.

Real-time updates and WebSockets are intentionally excluded from the MVP. Board changes are persisted through normal API requests and reflected in the active client after a successful response.

## Backend structure

The FastAPI application should be organized by responsibility:

```text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   ├── db/
│   │   ├── session.py
│   │   └── models/
│   ├── schemas/
│   ├── api/
│   │   └── routes/
│   ├── services/
│   └── dependencies/
├── alembic/
└── tests/
```

Routes should remain thin and delegate business rules to service functions. Authorization checks must run for every protected board, column, and task operation.

## Core data model

The MVP requires these tables:

- `users`
- `boards`
- `board_members`
- `columns`
- `tasks`

Important relationships and constraints:

- A board has one owner.
- A board has many members through `board_members`.
- A board has ordered columns.
- A column has ordered tasks.
- A task belongs to exactly one column.
- A task assignee must be a member of the task's board.
- `board_members` must have a unique `(board_id, user_id)` pair.
- A column cannot be deleted while tasks reference it.
- Board and task ordering is represented by a `position` field.

The backend should validate that a task's column belongs to the same board as the task. It should also validate that an assigned user belongs to that board.

## Authentication and authorization

The API will support:

- Registration
- Login
- Logout
- Current-user lookup

After login, the backend will issue an authentication token stored in an HTTP-only cookie. The frontend will send requests with credentials enabled. Passwords must be hashed using a modern password-hashing algorithm; plaintext passwords must never be stored.

For the MVP, board access is determined by ownership or membership:

```text
can_access_board(user, board)
  = board.owner_id == user.id
    OR user is present in board_members
```

All board members have the same task permissions. Only the board owner can rename or delete the board, manage columns, and add or remove members.

## API resource boundaries

The initial REST API should provide resources similar to:

```text
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /boards
POST   /boards
GET    /boards/{board_id}
PATCH  /boards/{board_id}
DELETE /boards/{board_id}

POST   /boards/{board_id}/members
DELETE /boards/{board_id}/members/{user_id}

POST   /boards/{board_id}/columns
PATCH  /columns/{column_id}
DELETE /columns/{column_id}
PATCH  /boards/{board_id}/columns/reorder

POST   /columns/{column_id}/tasks
GET    /tasks/{task_id}
PATCH  /tasks/{task_id}
DELETE /tasks/{task_id}
PATCH  /boards/{board_id}/tasks/reorder
```

Moving a task must update both its column and its position in one transaction. Reordering operations should be designed to keep positions deterministic and should return the updated board state or affected task ordering.

## Frontend structure

The React application should use feature-oriented modules:

```text
frontend/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   ├── boards/
│   │   ├── columns/
│   │   └── tasks/
│   ├── lib/
│   ├── routes/
│   └── types/
└── tests/
```

The board screen will use `@dnd-kit/core` for dragging tasks between columns and within a column. The client should optimistically update the interface only if rollback behavior is implemented; otherwise it should update local state after the API confirms the move.

## Validation and error handling

- Pydantic schemas validate request and response payloads.
- The API returns consistent JSON error responses with appropriate HTTP status codes.
- Invalid board access returns `403 Forbidden` or `404 Not Found` according to the chosen resource-visibility policy.
- Business-rule violations, such as deleting a non-empty column, return a clear client-facing error.
- Database writes that update related ordering or membership data use transactions.

## Deployment and environments

The frontend and backend may be deployed independently:

- Frontend: static Vite build served by the hosting provider.
- Backend: FastAPI process running with Uvicorn.
- Database: managed PostgreSQL.

Environment-specific configuration must be supplied through environment variables, including:

- Database connection URL
- JWT or token-signing secret
- Allowed frontend origin
- Secure-cookie and deployment environment settings

Local development should run the frontend, backend, and PostgreSQL through documented commands, with migrations managed by Alembic.

## Explicitly deferred from the MVP

The architecture does not include infrastructure for:

- WebSockets or real-time synchronization
- Email invitations
- Role hierarchies
- Notifications
- Comments, attachments, labels, or checklists
- Search, filters, analytics, or activity history
- Mobile clients

These can be added later without changing the core board, membership, column, and task model.
