# Mini Kanban backend

FastAPI implementation of the API in the repository-root `openapi.yaml`.
Data and login sessions are stored with SQLAlchemy. SQLite is used by default;
set `DATABASE_URL` to any SQLAlchemy-supported database URL to use another
database, such as PostgreSQL.

## Run locally

From `backend/`:

```powershell
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Interactive API docs are available at <http://127.0.0.1:8000/docs>.

The default database URL is `sqlite:///./kanban.db`, relative to the backend
working directory. For example, configure PostgreSQL before starting the app:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://user:password@localhost/mini_kanban"
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Install the appropriate SQLAlchemy database driver when using a non-SQLite
database. Tables are created automatically when the backend starts.

The seeded accounts all use password `demo1234`:

| Email | Name |
| --- | --- |
| `demo@kanban.dev` | Demo User (owns the seeded Team Project board) |
| `alex@kanban.dev` | Alex Kim |
| `sam@kanban.dev` | Sam Rivera |

Registration and login return the public user object, set an HTTP-only
`access_token` cookie, and expose the same opaque token in the `X-Auth-Token`
response header for API clients. Protected endpoints accept either that cookie
or an `Authorization` header containing the bearer token. Passwords are stored
as PBKDF2-HMAC-SHA256 hashes. Set `COOKIE_SECURE=true` when serving over HTTPS.

## Tests

From `backend/`:

```powershell
uv run pytest
```
