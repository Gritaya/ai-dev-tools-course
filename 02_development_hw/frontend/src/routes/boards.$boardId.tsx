import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AuthScreen } from "@/components/AuthScreen";
import { AppHeader } from "@/components/AppHeader";
import { TaskDialog } from "@/components/TaskDialog";
import { qk, useAction, useMe } from "@/hooks/use-kanban";
import { getService, type BoardDetail, type Task, type TaskInput, type User } from "@/services";

export const Route = createFileRoute("/boards/$boardId")({
  head: () => ({
    meta: [
      { title: "Board — MiniKanban" },
      { name: "description", content: "Drag tasks between workflow columns on your Kanban board." },
      { property: "og:title", content: "Board — MiniKanban" },
      { property: "og:description", content: "Drag tasks between workflow columns on your Kanban board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const me = useMe();
  if (me.isPending) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!me.data) return <AuthScreen />;
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader user={me.data} />
      <BoardView me={me.data} />
    </div>
  );
}

const priorityStyle: Record<string, string> = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-primary/15 text-primary",
  low: "bg-muted text-muted-foreground",
};

function BoardView({ me }: { me: User }) {
  const { boardId } = Route.useParams();
  const api = getService();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const key = qk.board(boardId);
  const q = useQuery({ queryKey: key, queryFn: () => api.getBoard(boardId), retry: false });
  const keys = [key, qk.boards] as const;

  const [dialog, setDialog] = useState<{ task: Task | null; columnId: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ col: string; pos: number } | null>(null);
  const [newCol, setNewCol] = useState("");

  const rename = useAction((n: string) => api.renameBoard(boardId, n), keys);
  const del = useAction(() => api.deleteBoard(boardId), [qk.boards]);
  const addCol = useAction((n: string) => api.createColumn(boardId, n), keys);
  const renameCol = useAction((a: { id: string; n: string }) => api.renameColumn(a.id, a.n), keys);
  const delCol = useAction((id: string) => api.deleteColumn(id), keys);
  const reorder = useAction((ids: string[]) => api.reorderColumns(boardId, ids), keys);
  const save = useAction(
    (a: { id?: string; input: TaskInput }) => (a.id ? api.updateTask(a.id, a.input) : api.createTask(boardId, a.input)),
    keys,
  );
  const delTask = useAction((id: string) => api.deleteTask(id), keys);
  const move = useAction((a: { id: string; col: string; pos: number }) => api.moveTask(a.id, a.col, a.pos), keys);

  if (q.isPending) return <div className="p-8 text-muted-foreground">Loading board…</div>;
  if (q.isError)
    return (
      <div className="p-8">
        <p>{q.error.message}</p>
        <Link to="/" className="text-primary underline">Back to boards</Link>
      </div>
    );

  const { board, columns, tasks, members } = q.data;
  const isOwner = board.ownerId === me.id;
  const memberName = (id?: string | null) => members.find((m) => m.id === id)?.name;

  function onDrop(colId: string, pos: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/task");
    if (!id) return;
    // Optimistic update so the card lands instantly
    qc.setQueryData<BoardDetail>(key, (d) => {
      if (!d) return d;
      const t = d.tasks.find((x) => x.id === id)!;
      const rest = d.tasks.filter((x) => x.columnId === colId && x.id !== id);
      rest.splice(pos, 0, { ...t, columnId: colId });
      const moved = rest.map((x, i) => ({ ...x, position: i }));
      return { ...d, tasks: [...d.tasks.filter((x) => x.columnId !== colId && x.id !== id), ...moved] };
    });
    move.mutate({ id, col: colId, pos });
  }

  function swapCol(i: number, dir: -1 | 1) {
    const ids = columns.map((c) => c.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    reorder.mutate(ids);
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Boards</Link>
        {isOwner ? (
          <input
            key={board.name}
            defaultValue={board.name}
            aria-label="Board name"
            onBlur={(e) => e.target.value.trim() && e.target.value !== board.name && rename.mutate(e.target.value)}
            className="rounded-md bg-transparent px-1 font-display text-3xl font-bold outline-none focus:bg-card focus:ring-2 focus:ring-ring"
          />
        ) : (
          <h1 className="font-display text-3xl font-bold">{board.name}</h1>
        )}
        <div className="ml-auto flex items-center gap-2">
          <MembersPopover boardId={boardId} members={members} ownerId={board.ownerId} isOwner={isOwner} />
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                confirm(`Delete "${board.name}" and all its tasks?`) &&
                del.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) })
              }
            >
              <Trash2 className="size-4" /> Delete board
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-1 items-start gap-4 overflow-x-auto pb-4">
        {columns.map((col, ci) => {
          const colTasks = tasks.filter((t) => t.columnId === col.id).sort((a, b) => a.position - b.position);
          return (
            <section
              key={col.id}
              data-testid={`column-${col.name}`}
              className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/70 p-3"
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOver?.col !== col.id) setDragOver({ col: col.id, pos: colTasks.length });
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={(e) => onDrop(col.id, dragOver?.col === col.id ? dragOver.pos : colTasks.length, e)}
            >
              <div className="mb-2 flex items-center gap-1">
                {isOwner ? (
                  <input
                    key={col.name}
                    defaultValue={col.name}
                    aria-label="Column name"
                    onBlur={(e) =>
                      e.target.value.trim() && e.target.value !== col.name && renameCol.mutate({ id: col.id, n: e.target.value })
                    }
                    className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-semibold uppercase tracking-wide outline-none focus:bg-card"
                  />
                ) : (
                  <h2 className="flex-1 px-1 text-sm font-semibold uppercase tracking-wide">{col.name}</h2>
                )}
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                {isOwner && (
                  <>
                    <IconBtn label="Move column left" disabled={ci === 0} onClick={() => swapCol(ci, -1)}><ArrowLeft /></IconBtn>
                    <IconBtn label="Move column right" disabled={ci === columns.length - 1} onClick={() => swapCol(ci, 1)}><ArrowRight /></IconBtn>
                    <IconBtn label="Delete column" onClick={() => delCol.mutate(col.id)}><Trash2 /></IconBtn>
                  </>
                )}
              </div>

              <div className="flex min-h-12 flex-col gap-2">
                {colTasks.map((t, i) => (
                  <div key={t.id}>
                    {dragOver?.col === col.id && dragOver.pos === i && <DropMarker />}
                    <article
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/task", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        const pos = e.clientY < r.top + r.height / 2 ? i : i + 1;
                        if (dragOver?.col !== col.id || dragOver.pos !== pos) setDragOver({ col: col.id, pos });
                      }}
                      onClick={() => setDialog({ task: t, columnId: col.id })}
                      className="cursor-grab rounded-md border bg-card p-3 text-sm shadow-sm transition hover:border-primary active:cursor-grabbing"
                    >
                      <div className="font-medium">{t.title}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        {t.priority && (
                          <span className={`rounded px-1.5 py-0.5 font-medium capitalize ${priorityStyle[t.priority]}`}>{t.priority}</span>
                        )}
                        {t.dueDate && <span className="text-muted-foreground">Due {t.dueDate}</span>}
                        {t.assigneeId && (
                          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
                            {memberName(t.assigneeId)}
                          </span>
                        )}
                      </div>
                    </article>
                  </div>
                ))}
                {dragOver?.col === col.id && dragOver.pos === colTasks.length && <DropMarker />}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="mt-2 justify-start text-muted-foreground"
                onClick={() => setDialog({ task: null, columnId: col.id })}
              >
                <Plus className="size-4" /> Add task
              </Button>
            </section>
          );
        })}

        {isOwner && (
          <form
            className="flex w-64 shrink-0 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCol.trim()) addCol.mutate(newCol, { onSuccess: () => setNewCol("") });
            }}
          >
            <Input placeholder="New column" value={newCol} onChange={(e) => setNewCol(e.target.value)} />
            <Button type="submit" size="icon" aria-label="Add column"><Plus className="size-4" /></Button>
          </form>
        )}
      </div>

      <TaskDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        task={dialog?.task ?? null}
        columnId={dialog?.columnId ?? ""}
        members={members}
        onSave={(input) => save.mutate({ id: dialog?.task?.id, input }, { onSuccess: () => setDialog(null) })}
        onDelete={dialog?.task ? () => delTask.mutate(dialog.task!.id, { onSuccess: () => setDialog(null) }) : undefined}
      />
    </main>
  );
}

function DropMarker() {
  return <div className="my-0.5 h-1 rounded-full bg-primary" />;
}

function IconBtn({ label, children, ...p }: { label: string; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30 [&_svg]:size-3.5"
      {...p}
    >
      {children}
    </button>
  );
}

function MembersPopover({ boardId, members, ownerId, isOwner }: { boardId: string; members: User[]; ownerId: string; isOwner: boolean }) {
  const api = getService();
  const [email, setEmail] = useState("");
  const keys = [qk.board(boardId), qk.boards] as const;
  const add = useAction((e: string) => api.addMember(boardId, e), keys);
  const remove = useAction((id: string) => api.removeMember(boardId, id), keys);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"><Users className="size-4" /> {members.length} members</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <ul className="space-y-2 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className="flex-1">
                {m.name} <span className="text-xs text-muted-foreground">{m.id === ownerId ? "· owner" : m.email}</span>
              </span>
              {isOwner && m.id !== ownerId && (
                <IconBtn label={`Remove ${m.name}`} onClick={() => remove.mutate(m.id)}><X /></IconBtn>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) add.mutate(email, { onSuccess: () => setEmail("") });
            }}
          >
            <Input placeholder="user@email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" size="sm">Add</Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
