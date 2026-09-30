import { beforeEach, describe, expect, it } from "vitest";
import { createMockService, memoryStore } from "./mock";
import type { KanbanService } from "./types";

let api: KanbanService;
const reg = (name: string) => api.register({ name, email: `${name}@x.dev`, password: "pw" });

beforeEach(() => {
  api = createMockService({ store: memoryStore() });
});

describe("auth", () => {
  it("registers, logs out, and logs in", async () => {
    const u = await reg("ann");
    expect(await api.getCurrentUser()).toEqual(u);
    await api.logout();
    expect(await api.getCurrentUser()).toBeNull();
    await expect(api.login({ email: "ann@x.dev", password: "bad" })).rejects.toThrow(/Invalid/);
    await api.login({ email: "ann@x.dev", password: "pw" });
    expect((await api.getCurrentUser())?.id).toBe(u.id);
  });
  it("rejects duplicate emails", async () => {
    await reg("ann");
    await expect(reg("ann")).rejects.toThrow(/already/);
  });
  it("requires a session for board calls", async () => {
    await expect(api.listBoards()).rejects.toThrow(/signed in/);
  });
});

describe("boards and membership", () => {
  it("creates a board with default columns and restricts access to members", async () => {
    await reg("bob");
    await api.logout();
    await reg("ann");
    const b = await api.createBoard("Personal");
    const d = await api.getBoard(b.id);
    expect(d.columns.map((c) => c.name)).toEqual(["To Do", "In Progress", "Done"]);

    await api.logout();
    await api.login({ email: "bob@x.dev", password: "pw" });
    expect(await api.listBoards()).toHaveLength(0);
    await expect(api.getBoard(b.id)).rejects.toThrow(/not found/);
  });

  it("only the owner can rename, delete, and manage members", async () => {
    const bob = await reg("bob");
    await api.logout();
    await reg("ann");
    const b = await api.createBoard("Team");
    await api.addMember(b.id, "bob@x.dev");
    await api.renameBoard(b.id, "Team 2");

    await api.logout();
    await api.login({ email: "bob@x.dev", password: "pw" });
    expect((await api.listBoards())[0].name).toBe("Team 2");
    await expect(api.renameBoard(b.id, "x")).rejects.toThrow(/owner/);
    await expect(api.deleteBoard(b.id)).rejects.toThrow(/owner/);
    await expect(api.removeMember(b.id, bob.id)).rejects.toThrow(/owner/);
  });

  it("removing a member unassigns their tasks", async () => {
    const bob = await reg("bob");
    await api.logout();
    await reg("ann");
    const b = await api.createBoard("Team");
    await api.addMember(b.id, "bob@x.dev");
    const { columns } = await api.getBoard(b.id);
    const t = await api.createTask(b.id, { title: "T", columnId: columns[0].id, assigneeId: bob.id });
    await api.removeMember(b.id, bob.id);
    const d = await api.getBoard(b.id);
    expect(d.members.map((m) => m.id)).not.toContain(bob.id);
    expect(d.tasks.find((x) => x.id === t.id)?.assigneeId).toBeNull();
  });
});

describe("columns", () => {
  it("cannot delete a column that has tasks", async () => {
    await reg("ann");
    const b = await api.createBoard("B");
    const [todo] = (await api.getBoard(b.id)).columns;
    const t = await api.createTask(b.id, { title: "T", columnId: todo.id });
    await expect(api.deleteColumn(todo.id)).rejects.toThrow(/tasks first/);
    await api.deleteTask(t.id);
    await api.deleteColumn(todo.id);
    const cols = (await api.getBoard(b.id)).columns;
    expect(cols.map((c) => c.position)).toEqual([0, 1]);
  });

  it("reorders columns", async () => {
    await reg("ann");
    const b = await api.createBoard("B");
    const ids = (await api.getBoard(b.id)).columns.map((c) => c.id);
    await api.reorderColumns(b.id, [ids[2], ids[0], ids[1]]);
    expect((await api.getBoard(b.id)).columns.map((c) => c.id)).toEqual([ids[2], ids[0], ids[1]]);
  });
});

describe("tasks", () => {
  async function setup() {
    await reg("ann");
    const b = await api.createBoard("B");
    const [a, bcol] = (await api.getBoard(b.id)).columns;
    const t1 = await api.createTask(b.id, { title: "one", columnId: a.id });
    const t2 = await api.createTask(b.id, { title: "two", columnId: a.id });
    const t3 = await api.createTask(b.id, { title: "three", columnId: a.id });
    return { b, a, bcol, t1, t2, t3 };
  }
  const order = async (boardId: string, colId: string) =>
    (await api.getBoard(boardId)).tasks.filter((t) => t.columnId === colId).map((t) => t.title);

  it("requires a title and a member assignee", async () => {
    const { b, a } = await setup();
    await expect(api.createTask(b.id, { title: "  ", columnId: a.id })).rejects.toThrow(/Title/);
    await expect(api.createTask(b.id, { title: "x", columnId: a.id, assigneeId: "nobody" })).rejects.toThrow(
      /member/,
    );
  });

  it("edits priority, due date, and description", async () => {
    const { t1 } = await setup();
    const u = await api.updateTask(t1.id, { priority: "high", dueDate: "2026-12-01", description: "d" });
    expect(u).toMatchObject({ priority: "high", dueDate: "2026-12-01", description: "d" });
    expect((await api.updateTask(t1.id, { dueDate: null })).dueDate).toBeNull();
  });

  it("moves a task across columns and renumbers both columns", async () => {
    const { b, a, bcol, t2 } = await setup();
    await api.moveTask(t2.id, bcol.id, 0);
    expect(await order(b.id, a.id)).toEqual(["one", "three"]);
    expect(await order(b.id, bcol.id)).toEqual(["two"]);
    const tasks = (await api.getBoard(b.id)).tasks.filter((t) => t.columnId === a.id);
    expect(tasks.map((t) => t.position)).toEqual([0, 1]);
  });

  it("reorders within a column and clamps positions", async () => {
    const { b, a, t1 } = await setup();
    await api.moveTask(t1.id, a.id, 99);
    expect(await order(b.id, a.id)).toEqual(["two", "three", "one"]);
    await api.moveTask(t1.id, a.id, -5);
    expect(await order(b.id, a.id)).toEqual(["one", "two", "three"]);
  });

  it("deleting a board removes its columns and tasks", async () => {
    const { b } = await setup();
    await api.deleteBoard(b.id);
    expect(await api.listBoards()).toHaveLength(0);
  });
});
