from pathlib import Path

from fastapi.testclient import TestClient
import pytest
import yaml

import app.store as store_module
from app.store import Store, verify_password


def test_store_persists_data_and_sessions_between_instances(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'persisted.db'}")
    first = Store(seed=False)
    user = first.create_user("user@example.com", "secret", "Test User")
    board = first.create_board(user, "Persistent board")
    token = first.issue_token(user.id)

    second = Store(seed=False)

    assert second.authenticate("user@example.com", "secret") == user
    assert second.user_for_token(token) == user
    assert [item.id for item in second.list_boards(user)] == [board.id]


def test_published_openapi_is_repository_contract(client: TestClient):
    contract = yaml.safe_load(
        (Path(__file__).resolve().parents[2] / "openapi.yaml").read_text(encoding="utf-8")
    )
    assert client.get("/openapi.json").json() == contract


def test_seed_authentication_and_board_data(client: TestClient):
    assert client.get("/auth/me").json() is None
    login = client.post(
        "/auth/login",
        json={"email": "demo@kanban.dev", "password": "demo1234"},
    )
    assert login.status_code == 200
    assert login.json() == {
        "id": "u_demo",
        "email": "demo@kanban.dev",
        "name": "Demo User",
    }
    assert login.headers["x-auth-token"]
    assert login.headers["set-cookie"].startswith("access_token=")
    token = login.headers["x-auth-token"]
    assert client.get("/users").status_code == 200
    board = client.get("/boards/b_team", headers={"Authorization": f"Bearer {token}"})
    assert board.status_code == 200
    assert board.json()["board"]["name"] == "Team Project"
    assert [column["name"] for column in board.json()["columns"]] == [
        "To Do",
        "In Progress",
        "Review",
        "Done",
    ]
    assert len(board.json()["tasks"]) == 5


def test_auth_required_and_logout_revokes_bearer_token(client: TestClient):
    assert client.get("/users").status_code == 401
    login = client.post(
        "/auth/login",
        json={"email": "demo@kanban.dev", "password": "demo1234"},
    )
    token = login.headers["x-auth-token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/users", headers=headers).status_code == 200
    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/users", headers=headers).status_code == 401


def test_register_hashes_password_and_sets_session(client: TestClient):
    response = client.post(
        "/auth/register",
        json={"email": "  New@Example.com ", "password": "secret", "name": " New User "},
    )
    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"
    assert response.json()["name"] == "New User"
    assert "secret" not in response.text
    stored_hash = store_module.store.password_hash_for(response.json()["id"])
    assert stored_hash != "secret"
    assert verify_password("secret", stored_hash)
    assert not verify_password("wrong", stored_hash)
    assert client.get("/auth/me").json()["id"] == response.json()["id"]
    assert client.post(
        "/auth/register",
        json={"email": "new@example.com", "password": "other", "name": "Duplicate"},
    ).status_code == 409


def test_board_owner_permissions_and_membership(client: TestClient, demo_headers: dict[str, str]):
    board = client.post("/boards", json={"name": "  New Board "}, headers=demo_headers)
    assert board.status_code == 201
    data = board.json()
    assert data["name"] == "New Board"
    assert data["memberIds"] == ["u_demo"]
    detail = client.get(f"/boards/{data['id']}", headers=demo_headers).json()
    column_id = detail["columns"][0]["id"]
    assert len(detail["columns"]) == 3

    added = client.post(
        f"/boards/{data['id']}/members",
        json={"email": "alex@kanban.dev"},
        headers=demo_headers,
    )
    assert added.status_code == 200
    alex_login = client.post(
        "/auth/login",
        json={"email": "alex@kanban.dev", "password": "demo1234"},
    )
    alex_headers = {"Authorization": f"Bearer {alex_login.headers['x-auth-token']}"}
    assert client.get(f"/boards/{data['id']}", headers=alex_headers).status_code == 200
    assert client.patch(
        f"/boards/{data['id']}",
        json={"name": "Not allowed"},
        headers=alex_headers,
    ).status_code == 403
    assert client.patch(
        f"/boards/{data['id']}",
        json={"name": "Renamed"},
        headers=demo_headers,
    ).json()["name"] == "Renamed"
    assert client.delete(
        f"/boards/{data['id']}/members/u_alex",
        headers=demo_headers,
    ).status_code == 204
    assert client.get(f"/boards/{data['id']}", headers=alex_headers).status_code == 404
    assert client.get(f"/columns/{column_id}", headers=demo_headers).status_code == 405


def test_board_owner_can_delete_board(client: TestClient, demo_headers: dict[str, str]):
    assert client.delete("/boards/b_team", headers=demo_headers).status_code == 204
    assert client.get("/boards/b_team", headers=demo_headers).status_code == 404


def test_columns_reorder_rename_and_nonempty_delete(client: TestClient, demo_headers: dict[str, str]):
    detail = client.get("/boards/b_team", headers=demo_headers).json()
    ids = [column["id"] for column in detail["columns"]]
    reordered = client.patch(
        "/boards/b_team/columns/reorder",
        json={"orderedColumnIds": ids[::-1]},
        headers=demo_headers,
    )
    assert reordered.status_code == 200
    assert [column["id"] for column in reordered.json()] == ids[::-1]
    assert client.patch(
        f"/columns/{ids[0]}",
        json={"name": "Ideas"},
        headers=demo_headers,
    ).json()["name"] == "Ideas"
    assert client.delete(f"/columns/{ids[0]}", headers=demo_headers).status_code == 409

    created = client.post(
        "/boards/b_team/columns",
        json={"name": "Empty"},
        headers=demo_headers,
    )
    assert created.status_code == 201
    assert client.delete(f"/columns/{created.json()['id']}", headers=demo_headers).status_code == 204


def test_task_create_update_move_delete_and_validation(client: TestClient, demo_headers: dict[str, str]):
    detail = client.get("/boards/b_team", headers=demo_headers).json()
    todo_id, in_progress_id = [column["id"] for column in detail["columns"][:2]]
    created = client.post(
        "/boards/b_team/tasks",
        json={
            "title": "  Test task ",
            "columnId": todo_id,
            "assigneeId": "u_alex",
            "priority": "high",
            "dueDate": "2026-12-01",
        },
        headers=demo_headers,
    )
    assert created.status_code == 201
    task = created.json()
    assert task["title"] == "Test task"
    assert task["position"] == 2
    changed = client.patch(
        f"/tasks/{task['id']}",
        json={"title": "Updated", "assigneeId": None, "dueDate": None},
        headers=demo_headers,
    )
    assert changed.status_code == 200
    assert changed.json()["title"] == "Updated"
    assert changed.json()["assigneeId"] is None
    assert changed.json()["dueDate"] is None
    moved = client.patch(
        f"/tasks/{task['id']}/move",
        json={"toColumnId": in_progress_id, "toPosition": 0},
        headers=demo_headers,
    )
    assert moved.status_code == 200
    assert moved.json()["columnId"] == in_progress_id
    assert moved.json()["position"] == 0
    assert client.delete(f"/tasks/{task['id']}", headers=demo_headers).status_code == 204
    assert client.post(
        "/boards/b_team/tasks",
        json={"title": "bad assignee", "columnId": todo_id, "assigneeId": "unknown"},
        headers=demo_headers,
    ).status_code == 422


def test_invalid_auth_and_inaccessible_board(client: TestClient):
    assert client.post(
        "/auth/login",
        json={"email": "demo@kanban.dev", "password": "wrong"},
    ).status_code == 401
    login = client.post(
        "/auth/login",
        json={"email": "sam@kanban.dev", "password": "demo1234"},
    )
    headers = {"Authorization": f"Bearer {login.headers['x-auth-token']}"}
    assert client.get("/boards/nonexistent", headers=headers).status_code == 404
    assert client.delete("/boards/b_team", headers=headers).status_code == 403
