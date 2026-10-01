import type {
  Board,
  BoardColumn,
  BoardDetail,
  Credentials,
  ID,
  KanbanService,
  RegisterInput,
  Task,
  User,
} from "./types";
import { ServiceError } from "./types";

const DEFAULT_API_URL = "http://127.0.0.1:8000";

type Fetcher = typeof fetch;

export function createHttpService(
  baseUrl = import.meta.env["VITE_API_URL"] || DEFAULT_API_URL,
  fetcher: Fetcher = fetch,
): KanbanService {
  const apiUrl = baseUrl.replace(/\/+$/, "");
  let authToken: string | null = null;

  async function throwResponseError(response: Response): Promise<never> {
    let message = response.statusText || `Request failed (${response.status})`;
    try {
      const error = (await response.json()) as { message?: unknown; detail?: unknown };
      if (typeof error.message === "string") message = error.message;
      else if (typeof error.detail === "string") message = error.detail;
    } catch {
      // Keep the HTTP status message when the error response has no JSON body.
    }
    throw new ServiceError(message);
  }

  async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const headers = new Headers();
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

    const response = await fetcher(`${apiUrl}${path}`, {
      method,
      headers,
      credentials: "include",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) await throwResponseError(response);

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async function authenticate(
    path: "/auth/login" | "/auth/register",
    input: Credentials | RegisterInput,
  ) {
    const headers = new Headers({ "Content-Type": "application/json" });
    const response = await fetcher(`${apiUrl}${path}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(input),
    });

    if (!response.ok) await throwResponseError(response);

    authToken = response.headers.get("X-Auth-Token");
    return (await response.json()) as User;
  }

  return {
    register: (input) => authenticate("/auth/register", input),
    login: (input) => authenticate("/auth/login", input),
    logout: async () => {
      await request<void>("/auth/logout", "POST");
      authToken = null;
    },
    getCurrentUser: () => request<User | null>("/auth/me"),
    listUsers: () => request<User[]>("/users"),

    listBoards: () => request<Board[]>("/boards"),
    getBoard: (boardId) => request<BoardDetail>(`/boards/${encodeURIComponent(boardId)}`),
    createBoard: (name) => request<Board>("/boards", "POST", { name }),
    renameBoard: (boardId, name) =>
      request<Board>(`/boards/${encodeURIComponent(boardId)}`, "PATCH", { name }),
    deleteBoard: (boardId) => request<void>(`/boards/${encodeURIComponent(boardId)}`, "DELETE"),
    addMember: (boardId, email) =>
      request<User>(`/boards/${encodeURIComponent(boardId)}/members`, "POST", { email }),
    removeMember: (boardId, userId) =>
      request<void>(
        `/boards/${encodeURIComponent(boardId)}/members/${encodeURIComponent(userId)}`,
        "DELETE",
      ),

    createColumn: (boardId, name) =>
      request<BoardColumn>(`/boards/${encodeURIComponent(boardId)}/columns`, "POST", { name }),
    renameColumn: (columnId, name) =>
      request<BoardColumn>(`/columns/${encodeURIComponent(columnId)}`, "PATCH", { name }),
    deleteColumn: (columnId) => request<void>(`/columns/${encodeURIComponent(columnId)}`, "DELETE"),
    reorderColumns: (boardId, orderedColumnIds) =>
      request<BoardColumn[]>(`/boards/${encodeURIComponent(boardId)}/columns/reorder`, "PATCH", {
        orderedColumnIds,
      }),

    createTask: (boardId, input) =>
      request<Task>(`/boards/${encodeURIComponent(boardId)}/tasks`, "POST", input),
    updateTask: (taskId, input) =>
      request<Task>(`/tasks/${encodeURIComponent(taskId)}`, "PATCH", input),
    deleteTask: (taskId) => request<void>(`/tasks/${encodeURIComponent(taskId)}`, "DELETE"),
    moveTask: (taskId, toColumnId, toPosition) =>
      request<Task>(`/tasks/${encodeURIComponent(taskId)}/move`, "PATCH", {
        toColumnId,
        toPosition,
      }),
  };
}
