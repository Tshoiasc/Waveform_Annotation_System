import pytest
import httpx

from app.api import templates as templates_module
from app.config import settings
from app.config.permissions import ROLE_PRESETS
from app.main import app
from app.services.auth_service import AuthService
from app.db import get_database


pytestmark = pytest.mark.anyio("asyncio")


@pytest.fixture
def anyio_backend():
    """强制 AnyIO 使用 asyncio 事件循环"""

    return "asyncio"


auth_service = AuthService(
    secret_key=settings.JWT_SECRET_KEY,
    algorithm=settings.JWT_ALGORITHM,
    expiration_days=settings.JWT_EXPIRATION_DAYS,
)


def _make_headers(permissions: list[str], role_name: str) -> dict[str, str]:
    token = auth_service.create_access_token(
        user_id="user-id",
        username="tester",
        role_id=f"role-{role_name}",
        role_name=role_name,
        permissions=permissions,
    )
    return {"Authorization": f"Bearer {token}"}


class StubTemplateRepository:
    """测试用模板仓储，使用内存字典模拟"""

    _initial_data = {
        "template-1": {
            "_id": "template-1",
            "name": "默认全局模板",
            "isGlobal": True,
            "createdBy": None,
            "phases": [
                {
                    "id": "phase-1",
                    "name": "阶段一",
                    "color": "#38bdf8",
                    "shortcut": "1",
                    "order": 0,
                }
            ],
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
        }
    }

    _counter: int = 100

    def __init__(self, db):  # noqa: D401 - 测试桩无需实现
        self._ensure_seed_data()

    @classmethod
    def _ensure_seed_data(cls) -> None:
        cls._storage = {k: v.copy() for k, v in cls._initial_data.items()}

    async def find_all(self):
        return list(self._storage.values())

    async def find_by_id(self, template_id: str):
        return self._storage.get(template_id)

    async def insert_one(self, data: dict) -> str:
        self.__class__._counter += 1
        new_id = f"template-{self._counter}"
        stored = {
            "_id": new_id,
            **data,
            "isGlobal": True,
            "createdBy": None,
        }
        self._storage[new_id] = stored
        return new_id

    async def update_one(self, template_id: str, updates: dict) -> bool:
        if template_id not in self._storage:
            return False
        self._storage[template_id].update(updates)
        return True

    async def delete_one(self, template_id: str) -> bool:
        return self._storage.pop(template_id, None) is not None


@pytest.fixture(autouse=True)
def stub_repository(monkeypatch):
    """替换真实的模板仓储为内存实现"""

    monkeypatch.setattr(templates_module, "TemplateRepository", StubTemplateRepository)

    # 每次测试前重置存储
    StubTemplateRepository._ensure_seed_data()
    yield


@pytest.fixture(autouse=True)
def override_db_dependency():
    """覆盖数据库依赖，避免实际连接"""

    async def _get_db():
        return None

    app.dependency_overrides[get_database] = _get_db
    yield
    app.dependency_overrides.pop(get_database, None)


@pytest.fixture
async def async_client() -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=True)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


async def test_user_without_view_permission_gets_403(async_client: httpx.AsyncClient):
    headers = _make_headers([], role_name="guest")
    response = await async_client.get("/api/templates", headers=headers)
    assert response.status_code == 403


async def test_annotator_can_view_templates(async_client: httpx.AsyncClient):
    headers = _make_headers(ROLE_PRESETS["annotator"], role_name="annotator")
    response = await async_client.get("/api/templates", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert payload[0]["isGlobal"] is True


async def test_admin_can_create_template(async_client: httpx.AsyncClient):
    headers = _make_headers(ROLE_PRESETS["admin"], role_name="admin")
    data = {
        "name": "新模板",
        "phases": [
            {"id": "p1", "name": "阶段一", "color": "#ff0000", "shortcut": "1", "order": 0},
            {"id": "p2", "name": "阶段二", "color": "#00ff00", "shortcut": "2", "order": 1},
        ],
    }

    response = await async_client.post("/api/templates", json=data, headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["isGlobal"] is True
    assert payload.get("createdBy") is None


async def test_annotator_cannot_create_template(async_client: httpx.AsyncClient):
    headers = _make_headers(ROLE_PRESETS["annotator"], role_name="annotator")
    data = {
        "name": "无权限模板",
        "phases": [
            {"id": "p1", "name": "阶段一", "color": "#ff0000", "shortcut": "1", "order": 0},
            {"id": "p2", "name": "阶段二", "color": "#00ff00", "shortcut": "2", "order": 1},
        ],
    }

    response = await async_client.post("/api/templates", json=data, headers=headers)
    assert response.status_code == 403


async def test_admin_can_update_template(async_client: httpx.AsyncClient):
    headers = _make_headers(ROLE_PRESETS["admin"], role_name="admin")
    data = {
        "name": "更新后的模板",
    }

    response = await async_client.put("/api/templates/template-1", json=data, headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "更新后的模板"


async def test_admin_can_delete_template(async_client: httpx.AsyncClient):
    headers = _make_headers(ROLE_PRESETS["admin"], role_name="admin")

    response = await async_client.delete("/api/templates/template-1", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True


async def test_annotator_cannot_delete_template(async_client: httpx.AsyncClient):
    headers = _make_headers(ROLE_PRESETS["annotator"], role_name="annotator")

    response = await async_client.delete("/api/templates/template-1", headers=headers)
    assert response.status_code == 403
