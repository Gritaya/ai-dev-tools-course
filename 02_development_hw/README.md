The frontend was adapted from
[`Gritaya/kanban-flow`](https://github.com/Gritaya/kanban-flow)

## Backend

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then run
these commands from this directory:

```sh
make install
make run
```

The backend runs at <http://127.0.0.1:8000>; interactive API docs are at
<http://127.0.0.1:8000/docs>. Run the backend tests with `make test`.

On Windows, use GNU Make from Git Bash or install a Make-compatible tool. You
can run the equivalent commands from PowerShell:

```powershell
Set-Location backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```