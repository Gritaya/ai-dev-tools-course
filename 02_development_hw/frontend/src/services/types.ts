export type ID = string;

export type Priority = "low" | "medium" | "high";

export interface User {
  id: ID;
  email: string;
  name: string;
}

export interface Board {
  id: ID;
  name: string;
  ownerId: ID;
  memberIds: ID[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  id: ID;
  boardId: ID;
  name: string;
  position: number;
}

export interface Task {
  id: ID;
  boardId: ID;
  columnId: ID;
  title: string;
  description?: string;
  assigneeId?: ID | null;
  priority?: Priority | null;
  dueDate?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardDetail {
  board: Board;
  columns: BoardColumn[];
  tasks: Task[];
  members: User[];
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterInput extends Credentials {
  name: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  assigneeId?: ID | null;
  priority?: Priority | null;
  dueDate?: string | null;
  columnId: ID;
}

/**
 * The single contract every backend call in the app goes through.
 * The UI never talks to storage or HTTP directly.
 */
export interface KanbanService {
  // auth
  register(input: RegisterInput): Promise<User>;
  login(input: Credentials): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  listUsers(): Promise<User[]>;

  // boards
  listBoards(): Promise<Board[]>;
  getBoard(boardId: ID): Promise<BoardDetail>;
  createBoard(name: string): Promise<Board>;
  renameBoard(boardId: ID, name: string): Promise<Board>;
  deleteBoard(boardId: ID): Promise<void>;
  addMember(boardId: ID, email: string): Promise<User>;
  removeMember(boardId: ID, userId: ID): Promise<void>;

  // columns
  createColumn(boardId: ID, name: string): Promise<BoardColumn>;
  renameColumn(columnId: ID, name: string): Promise<BoardColumn>;
  deleteColumn(columnId: ID): Promise<void>;
  reorderColumns(boardId: ID, orderedColumnIds: ID[]): Promise<BoardColumn[]>;

  // tasks
  createTask(boardId: ID, input: TaskInput): Promise<Task>;
  updateTask(taskId: ID, input: Partial<TaskInput>): Promise<Task>;
  deleteTask(taskId: ID): Promise<void>;
  moveTask(taskId: ID, toColumnId: ID, toPosition: number): Promise<Task>;
}

export class ServiceError extends Error {}
