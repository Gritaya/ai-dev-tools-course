import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import Store
import app.store as store_module


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    test_store = Store(seed=True)
    monkeypatch.setattr(store_module, "store", test_store)
    from app import auth
    from app.routers import auth as auth_router
    from app.routers import boards, columns, tasks, users

    monkeypatch.setattr(auth, "store", test_store)
    monkeypatch.setattr(auth_router, "store", test_store)
    for module in (boards, columns, tasks, users):
        monkeypatch.setattr(module, "store", test_store)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def demo_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/auth/login",
        json={"email": "demo@kanban.dev", "password": "demo1234"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.headers['x-auth-token']}"}

