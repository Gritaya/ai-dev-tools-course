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
- `createMockService` (src/services/mock.ts) is the default backend. It saves to localStorage in the browser and to memory in tests. Why: the app runs with no server.
- Service tests use `createMockService({ store: memoryStore() })` and run with `bun run test` (vitest). Why: each test is isolated and fast.
