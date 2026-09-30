# Frontend

This is the Kanban app's React and TypeScript frontend, built with Vite and TanStack Start.

## Prerequisites

- [Bun](https://bun.sh/) installed
- Git, if you are cloning the repository

Use Bun for package management and scripts. The project includes `bun.lock`; using Bun keeps installs consistent with the committed lockfile.

## Run locally

From the repository root:

```sh
cd frontend
bun install --frozen-lockfile
bun run dev
```

Open the local URL printed by the dev server in your terminal. Keep that terminal open while developing; press `Ctrl+C` to stop the server.

The frontend currently uses a mock Kanban service, so you do not need to start the backend. Board data is saved in the browser's `localStorage`.

## Common commands

Run these from the `frontend/` directory:

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run test` | Run the test suite |
| `bun run lint` | Check code with ESLint |
| `bun run build` | Create a production build |
| `bun run preview` | Preview the production build locally |

To preview a production build:

```sh
bun run build
bun run preview
```
