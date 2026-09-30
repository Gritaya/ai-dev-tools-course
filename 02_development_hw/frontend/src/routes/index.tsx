import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthScreen } from "@/components/AuthScreen";
import { AppHeader } from "@/components/AppHeader";
import { qk, useAction, useMe } from "@/hooks/use-kanban";
import { getService } from "@/services";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Boards — MiniKanban" },
      { name: "description", content: "A mini Kanban board for personal and small-team task management." },
      { property: "og:title", content: "My Boards — MiniKanban" },
      { property: "og:description", content: "Create boards, custom columns, and drag tasks across your workflow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const me = useMe();
  if (me.isPending) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!me.data) return <AuthScreen />;
  return (
    <div className="min-h-screen">
      <AppHeader user={me.data} />
      <BoardList userId={me.data.id} />
    </div>
  );
}

function BoardList({ userId }: { userId: string }) {
  const boards = useQuery({ queryKey: qk.boards, queryFn: () => getService().listBoards() });
  const [name, setName] = useState("");
  const create = useAction((n: string) => getService().createBoard(n), [qk.boards]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">My Boards</h1>
      <form
        className="mt-6 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate(name, { onSuccess: () => setName("") });
        }}
      >
        <Input placeholder="New board name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={create.isPending}>
          <Plus className="size-4" /> Create board
        </Button>
      </form>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.data?.map((b) => (
          <Link
            key={b.id}
            to="/boards/$boardId"
            params={{ boardId: b.id }}
            className="group rounded-lg border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary"
          >
            <div className="font-display text-lg font-semibold group-hover:text-primary">{b.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {b.ownerId === userId ? "Owner" : "Member"} · {b.memberIds.length} member
              {b.memberIds.length === 1 ? "" : "s"}
            </div>
          </Link>
        ))}
        {boards.data?.length === 0 && <p className="text-muted-foreground">No boards yet — create one above.</p>}
      </div>
    </main>
  );
}
