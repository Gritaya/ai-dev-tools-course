import {
  ServiceError,
  type Board,
  type BoardColumn,
  type ID,
  type KanbanService,
  type Task,
  type User,
} from "./types";

interface StoredUser extends User {
  password: string;
}

interface DB {
  users: StoredUser[];
  boards: Board[];
  columns: BoardColumn[];
  tasks: Task[];
  sessionUserId: ID | null;
}

/** Minimal key/value persistence so the mock can use localStorage or memory. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}

export function browserStore(): KeyValueStore {
  if (typeof window === "undefined") return memoryStore();
  return {
    get: (k) => window.localStorage.getItem(k),
    set: (k, v) => window.localStorage.setItem(k, v),
  };
}

const KEY = "mini-kanban-db-v1";

function emptyDB(): DB {
  return { users: [], boards: [], columns: [], tasks: [], sessionUserId: null };
}

let counter = 0;
function uid(prefix: string) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

const publicUser = ({ password: _p, ...u }: StoredUser): User => u;

export interface MockOptions {
  store?: KeyValueStore;
  latencyMs?: number;
  seed?: boolean;
}

export function createMockService(opts: MockOptions = {}): KanbanService {
  const store = opts.store ?? memoryStore();
  const latency = opts.latencyMs ?? 0;

  const load = (): DB => {
    const raw = store.get(KEY);
    if (raw) return JSON.parse(raw) as DB;
    const db = emptyDB();
    if (opts.seed) seedDemo(db);
    store.set(KEY, JSON.stringify(db));
    return db;
  };
  const save = (db: DB) => store.set(KEY, JSON.stringify(db));

  /** Wraps each op: simulated latency, load → mutate → save, returns clones. */
  async function run<T>(fn: (db: DB) => T): Promise<T> {
    if (latency) await new Promise((r) => setTimeout(r, latency));
    const db = load();
    const result = fn(db);
    save(db);
    return result === undefined ? result : (structuredClone(result) as T);
  }

  const me = (db: DB): StoredUser => {
    const u = db.users.find((x) => x.id === db.sessionUserId);
    if (!u) throw new ServiceError("Not signed in");
    return u;
  };
  const boardFor = (db: DB, boardId: ID): Board => {
    const u = me(db);
    const b = db.boards.find((x) => x.id === boardId);
    if (!b || !b.memberIds.includes(u.id)) throw new ServiceError("Board not found");
    return b;
  };
  const ownedBoard = (db: DB, boardId: ID): Board => {
    const b = boardFor(db, boardId);
    if (b.ownerId !== me(db).id) throw new ServiceError("Only the board owner can do that");
    return b;
  };
  const columnFor = (db: DB, columnId: ID) => {
    const c = db.columns.find((x) => x.id === columnId);
    if (!c) throw new ServiceError("Column not found");
    return { column: c, board: boardFor(db, c.boardId) };
  };
  const taskFor = (db: DB, taskId: ID) => {
    const t = db.tasks.find((x) => x.id === taskId);
    if (!t) throw new ServiceError("Task not found");
    return { task: t, board: boardFor(db, t.boardId) };
  };
  const touch = (b: Board) => (b.updatedAt = new Date().toISOString());
  const renumber = (db: DB, columnId: ID) =>
    db.tasks
      .filter((t) => t.columnId === columnId)
      .sort((a, b) => a.position - b.position)
      .forEach((t, i) => (t.position = i));
  const checkAssignee = (b: Board, assigneeId?: ID | null) => {
    if (assigneeId && !b.memberIds.includes(assigneeId))
      throw new ServiceError("Assignee must be a board member");
  };
  const cleanTitle = (t: string) => {
    const v = t.trim();
    if (!v) throw new ServiceError("Title is required");
    return v;
  };

  return {
    register: ({ email, password, name }) =>
      run((db) => {
        const e = email.trim().toLowerCase();
        if (!e || !password || !name.trim()) throw new ServiceError("All fields are required");
        if (db.users.some((u) => u.email === e)) throw new ServiceError("Email already registered");
        const u: StoredUser = { id: uid("u"), email: e, name: name.trim(), password };
        db.users.push(u);
        db.sessionUserId = u.id;
        return publicUser(u);
      }),
    login: ({ email, password }) =>
      run((db) => {
        const u = db.users.find((x) => x.email === email.trim().toLowerCase());
        if (!u || u.password !== password) throw new ServiceError("Invalid email or password");
        db.sessionUserId = u.id;
        return publicUser(u);
      }),
    logout: () =>
      run((db) => {
        db.sessionUserId = null;
      }),
    getCurrentUser: () =>
      run((db) => {
        const u = db.users.find((x) => x.id === db.sessionUserId);
        return u ? publicUser(u) : null;
      }),
    listUsers: () =>
      run((db) => {
        me(db);
        return db.users.map(publicUser);
      }),

    listBoards: () =>
      run((db) => {
        const u = me(db);
        return db.boards
          .filter((b) => b.memberIds.includes(u.id))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      }),
    getBoard: (boardId) =>
      run((db) => {
        const board = boardFor(db, boardId);
        return {
          board,
          columns: db.columns.filter((c) => c.boardId === boardId).sort((a, b) => a.position - b.position),
          tasks: db.tasks.filter((t) => t.boardId === boardId).sort((a, b) => a.position - b.position),
          members: db.users.filter((u) => board.memberIds.includes(u.id)).map(publicUser),
        };
      }),
    createBoard: (name) =>
      run((db) => {
        const u = me(db);
        const n = name.trim();
        if (!n) throw new ServiceError("Board name is required");
        const now = new Date().toISOString();
        const b: Board = { id: uid("b"), name: n, ownerId: u.id, memberIds: [u.id], createdAt: now, updatedAt: now };
        db.boards.push(b);
        ["To Do", "In Progress", "Done"].forEach((cn, i) =>
          db.columns.push({ id: uid("c"), boardId: b.id, name: cn, position: i }),
        );
        return b;
      }),
    renameBoard: (boardId, name) =>
      run((db) => {
        const b = ownedBoard(db, boardId);
        const n = name.trim();
        if (!n) throw new ServiceError("Board name is required");
        b.name = n;
        touch(b);
        return b;
      }),
    deleteBoard: (boardId) =>
      run((db) => {
        ownedBoard(db, boardId);
        db.boards = db.boards.filter((b) => b.id !== boardId);
        db.columns = db.columns.filter((c) => c.boardId !== boardId);
        db.tasks = db.tasks.filter((t) => t.boardId !== boardId);
      }),
    addMember: (boardId, email) =>
      run((db) => {
        const b = ownedBoard(db, boardId);
        const u = db.users.find((x) => x.email === email.trim().toLowerCase());
        if (!u) throw new ServiceError("No user with that email");
        if (b.memberIds.includes(u.id)) throw new ServiceError("Already a member");
        b.memberIds.push(u.id);
        touch(b);
        return publicUser(u);
      }),
    removeMember: (boardId, userId) =>
      run((db) => {
        const b = ownedBoard(db, boardId);
        if (userId === b.ownerId) throw new ServiceError("The owner cannot be removed");
        b.memberIds = b.memberIds.filter((id) => id !== userId);
        db.tasks.forEach((t) => {
          if (t.boardId === boardId && t.assigneeId === userId) t.assigneeId = null;
        });
        touch(b);
      }),

    createColumn: (boardId, name) =>
      run((db) => {
        ownedBoard(db, boardId);
        const n = name.trim();
        if (!n) throw new ServiceError("Column name is required");
        const position = db.columns.filter((c) => c.boardId === boardId).length;
        const c: BoardColumn = { id: uid("c"), boardId, name: n, position };
        db.columns.push(c);
        return c;
      }),
    renameColumn: (columnId, name) =>
      run((db) => {
        const { column } = columnFor(db, columnId);
        ownedBoard(db, column.boardId);
        const n = name.trim();
        if (!n) throw new ServiceError("Column name is required");
        column.name = n;
        return column;
      }),
    deleteColumn: (columnId) =>
      run((db) => {
        const { column } = columnFor(db, columnId);
        ownedBoard(db, column.boardId);
        if (db.tasks.some((t) => t.columnId === columnId))
          throw new ServiceError("Move or delete this column's tasks first");
        db.columns = db.columns.filter((c) => c.id !== columnId);
        db.columns
          .filter((c) => c.boardId === column.boardId)
          .sort((a, b) => a.position - b.position)
          .forEach((c, i) => (c.position = i));
      }),
    reorderColumns: (boardId, ids) =>
      run((db) => {
        ownedBoard(db, boardId);
        const cols = db.columns.filter((c) => c.boardId === boardId);
        if (ids.length !== cols.length || !cols.every((c) => ids.includes(c.id)))
          throw new ServiceError("Invalid column order");
        cols.forEach((c) => (c.position = ids.indexOf(c.id)));
        return cols.sort((a, b) => a.position - b.position);
      }),

    createTask: (boardId, input) =>
      run((db) => {
        const b = boardFor(db, boardId);
        const { column } = columnFor(db, input.columnId);
        if (column.boardId !== boardId) throw new ServiceError("Column not on this board");
        checkAssignee(b, input.assigneeId);
        const now = new Date().toISOString();
        const t: Task = {
          id: uid("t"),
          boardId,
          columnId: column.id,
          title: cleanTitle(input.title),
          description: input.description ?? "",
          assigneeId: input.assigneeId ?? null,
          priority: input.priority ?? null,
          dueDate: input.dueDate ?? null,
          position: db.tasks.filter((x) => x.columnId === column.id).length,
          createdAt: now,
          updatedAt: now,
        };
        db.tasks.push(t);
        return t;
      }),
    updateTask: (taskId, input) =>
      run((db) => {
        const { task, board } = taskFor(db, taskId);
        if (input.title !== undefined) task.title = cleanTitle(input.title);
        if (input.description !== undefined) task.description = input.description;
        if (input.assigneeId !== undefined) {
          checkAssignee(board, input.assigneeId);
          task.assigneeId = input.assigneeId;
        }
        if (input.priority !== undefined) task.priority = input.priority;
        if (input.dueDate !== undefined) task.dueDate = input.dueDate;
        task.updatedAt = new Date().toISOString();
        return task;
      }),
    deleteTask: (taskId) =>
      run((db) => {
        const { task } = taskFor(db, taskId);
        db.tasks = db.tasks.filter((t) => t.id !== taskId);
        renumber(db, task.columnId);
      }),
    moveTask: (taskId, toColumnId, toPosition) =>
      run((db) => {
        const { task } = taskFor(db, taskId);
        const { column } = columnFor(db, toColumnId);
        if (column.boardId !== task.boardId) throw new ServiceError("Column not on this board");
        const from = task.columnId;
        const siblings = db.tasks
          .filter((t) => t.columnId === toColumnId && t.id !== taskId)
          .sort((a, b) => a.position - b.position);
        const pos = Math.max(0, Math.min(toPosition, siblings.length));
        siblings.splice(pos, 0, task);
        task.columnId = toColumnId;
        siblings.forEach((t, i) => (t.position = i));
        if (from !== toColumnId) renumber(db, from);
        task.updatedAt = new Date().toISOString();
        return task;
      }),
  };
}

function seedDemo(db: DB) {
  const now = new Date().toISOString();
  const users: StoredUser[] = [
    { id: "u_demo", email: "demo@kanban.dev", name: "Demo User", password: "demo1234" },
    { id: "u_alex", email: "alex@kanban.dev", name: "Alex Kim", password: "demo1234" },
    { id: "u_sam", email: "sam@kanban.dev", name: "Sam Rivera", password: "demo1234" },
  ];
  db.users.push(...users);
  const board: Board = {
    id: "b_team", name: "Team Project", ownerId: "u_demo",
    memberIds: ["u_demo", "u_alex", "u_sam"], createdAt: now, updatedAt: now,
  };
  db.boards.push(board);
  const cols = ["To Do", "In Progress", "Review", "Done"].map((name, i) => ({
    id: `c_${i}`, boardId: board.id, name, position: i,
  }));
  db.columns.push(...cols);
  const tasks: [string, number, ID | null, Task["priority"]][] = [
    ["Fix login redirect", 0, "u_alex", "high"],
    ["Write onboarding copy", 0, null, "low"],
    ["Build tasks API", 1, "u_demo", "medium"],
    ["Review column rules", 2, "u_sam", "medium"],
    ["Set up repository", 3, "u_demo", null],
  ];
  tasks.forEach(([title, ci, assigneeId, priority]) => {
    const colId = cols[ci].id;
    db.tasks.push({
      id: `t_${db.tasks.length}`, boardId: board.id, columnId: colId, title, description: "",
      assigneeId, priority: priority ?? null, dueDate: null,
      position: db.tasks.filter((t) => t.columnId === colId).length,
      createdAt: now, updatedAt: now,
    });
  });
}
