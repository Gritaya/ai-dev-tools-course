import { describe, expect, it, vi } from "vitest";
import { createHttpService } from "./http";

describe("HTTP service", () => {
  it("uses the backend session token and cookies for authentication", async () => {
    const user = { id: "u1", email: "ann@example.com", name: "Ann" };
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/login") {
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { "X-Auth-Token": "session-token" },
        });
      }
      if (path === "/auth/logout") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(user), { status: 200 });
    });
    const api = createHttpService("http://api.test/", fetcher);

    await expect(api.login({ email: user.email, password: "secret" })).resolves.toEqual(user);
    await expect(api.getCurrentUser()).resolves.toEqual(user);
    await api.logout();
    await api.getCurrentUser();

    const calls = fetcher.mock.calls;
    expect(calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ email: user.email, password: "secret" }),
    });
    expect(new Headers(calls[1]?.[1]?.headers).get("Authorization")).toBe("Bearer session-token");
    expect(new Headers(calls[3]?.[1]?.headers).has("Authorization")).toBe(false);
  });

  it("maps service operations to the backend routes and request fields", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({}),
    );
    const api = createHttpService("http://api.test", fetcher);

    await api.listUsers();
    await api.listBoards();
    await api.getBoard("b1");
    await api.createBoard("Board");
    await api.renameBoard("b1", "Renamed");
    await api.deleteBoard("b1");
    await api.addMember("b1", "ann@example.com");
    await api.removeMember("b1", "u1");
    await api.createColumn("b1", "Review");
    await api.renameColumn("c1", "Done");
    await api.deleteColumn("c1");
    await api.reorderColumns("b1", ["c2", "c1"]);
    await api.createTask("b1", { title: "Task", columnId: "c1" });
    await api.updateTask("t1", { dueDate: null });
    await api.deleteTask("t1");
    await api.moveTask("t1", "c2", 3);

    const calls = fetcher.mock.calls;
    const requests = calls.map(([input, init]) => ({
      method: init?.method ?? "GET",
      path: new URL(String(input)).pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }));
    expect(requests).toEqual([
      { method: "GET", path: "/users", body: undefined },
      { method: "GET", path: "/boards", body: undefined },
      { method: "GET", path: "/boards/b1", body: undefined },
      { method: "POST", path: "/boards", body: { name: "Board" } },
      { method: "PATCH", path: "/boards/b1", body: { name: "Renamed" } },
      { method: "DELETE", path: "/boards/b1", body: undefined },
      { method: "POST", path: "/boards/b1/members", body: { email: "ann@example.com" } },
      { method: "DELETE", path: "/boards/b1/members/u1", body: undefined },
      { method: "POST", path: "/boards/b1/columns", body: { name: "Review" } },
      { method: "PATCH", path: "/columns/c1", body: { name: "Done" } },
      { method: "DELETE", path: "/columns/c1", body: undefined },
      {
        method: "PATCH",
        path: "/boards/b1/columns/reorder",
        body: { orderedColumnIds: ["c2", "c1"] },
      },
      { method: "POST", path: "/boards/b1/tasks", body: { title: "Task", columnId: "c1" } },
      { method: "PATCH", path: "/tasks/t1", body: { dueDate: null } },
      { method: "DELETE", path: "/tasks/t1", body: undefined },
      { method: "PATCH", path: "/tasks/t1/move", body: { toColumnId: "c2", toPosition: 3 } },
    ]);
    expect(calls.every(([, init]) => init?.credentials === "include")).toBe(true);
  });

  it("surfaces backend error messages", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ message: "Email already registered" }, { status: 409 }),
    );
    const api = createHttpService("http://api.test", fetcher);

    await expect(
      api.register({ name: "Ann", email: "ann@example.com", password: "secret" }),
    ).rejects.toThrow("Email already registered");
  });
});
