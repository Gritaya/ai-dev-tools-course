<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- All backend calls go through `getService()` (src/services/index.ts), which returns a `KanbanService`. Why: the UI can swap the mock for a real backend in one place.
- `createHttpService` (src/services/http.ts) is the default backend client and reads `VITE_API_URL` (default: `http://127.0.0.1:8000`).
- Service tests use `createMockService({ store: memoryStore() })` and run with `bun run test` (vitest). Why: each test is isolated and fast.
