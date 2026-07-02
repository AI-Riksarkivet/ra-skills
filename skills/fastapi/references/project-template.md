# FastAPI Project Template

Reference layout and patterns for production FastAPI projects: structure, configuration, dependency injection, repository/service layers, auth, and testing.

Examples follow the parent skill's conventions — `Annotated` for parameters and dependencies, no `...` for required fields, return types on path operations, and one HTTP operation per function.

## Contents

- Recommended project layout
- Application entry, settings, database
- Repository pattern
- Service layer
- API endpoints
- Authentication → [`authn.md`](authn.md) · Authorization → [`authz.md`](authz.md)
- Testing
- Common pitfalls

## Recommended Project Layout

```
app/
├── api/                    # API routes
│   ├── v1/
│   │   ├── endpoints/
│   │   │   ├── users.py
│   │   │   ├── auth.py
│   │   │   └── items.py
│   │   └── router.py
│   └── dependencies.py     # Shared dependencies
├── core/                   # Core configuration
│   ├── config.py
│   └── security.py
├── models/                 # Database models (SQLModel)
│   ├── user.py
│   └── item.py
├── schemas/                # Pydantic request/response schemas
│   ├── user.py
│   └── item.py
├── services/               # Business logic
│   ├── user_service.py
│   └── auth_service.py
├── repositories/           # Data access
│   ├── user_repository.py
│   └── item_repository.py
└── main.py                 # Application entry
```

Use `services/` to keep business logic out of route handlers and `repositories/` to keep data access out of services.

## Application Entry, Settings, Database

```python
# main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.api.v1.router import api_router
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Build the engine here, never at module import (SKILL.md top gotcha #2).
    app.state.db_engine = create_async_engine(
        str(settings.DATABASE_URL),
        pool_pre_ping=True,        # full pool flags: database.md § Engine creation
    )
    async with app.state.db_engine.connect() as conn:
        await conn.execute(text("SELECT 1"))   # fail fast on bad URL / unreachable DB
    yield
    await app.state.db_engine.dispose()


app = FastAPI(title="API Template", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,   # explicit origins — never "*" with credentials
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
```

```python
# core/config.py
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: list[str] = []

    model_config = SettingsConfigDict(env_file=".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

Models are **SQLModel** classes (see [`database.md`](database.md) § Stack) — no `declarative_base()`; tables come from Alembic migrations, not `create_all()`. The per-request session dependency (`get_db` reading `request.app.state.db_engine`, commit on success, rollback on error) and its `SessionDep` alias are defined once in [`production-patterns.md`](production-patterns.md) § Dependency injection from `app.state` — copy them into `api/dependencies.py` verbatim; the endpoints below consume `SessionDep`.

## Repository Pattern

```python
# repositories/base_repository.py — PEP 695 generics (3.12+)
from pydantic import BaseModel
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession


class BaseRepository[Model, CreateSchema: BaseModel, UpdateSchema: BaseModel]:
    def __init__(self, model: type[Model]) -> None:
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> Model | None:
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalars().first()

    async def get_multi(
        self, db: AsyncSession, skip: int = 0, limit: int = 100,
    ) -> list[Model]:
        result = await db.execute(select(self.model).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def create(
        self, db: AsyncSession, obj_in: CreateSchema | dict[str, object]
    ) -> Model:
        data = obj_in.model_dump() if isinstance(obj_in, BaseModel) else obj_in
        db_obj = self.model(**data)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, db_obj: Model, obj_in: UpdateSchema | dict[str, object]
    ) -> Model:
        data = obj_in.model_dump(exclude_unset=True) if isinstance(obj_in, BaseModel) else obj_in
        for field, value in data.items():
            setattr(db_obj, field, value)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, id: int) -> bool:
        obj = await self.get(db, id)
        if obj is None:
            return False
        await db.delete(obj)
        return True
```

```python
# repositories/user_repository.py
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.repositories.base_repository import BaseRepository
from app.schemas.user import UserCreate, UserUpdate


class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalars().first()


user_repository = UserRepository(User)
```

## Service Layer

```python
# services/user_service.py
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password, verify_password  # authn.md § Password hashing
from app.models.user import User
from app.repositories.user_repository import user_repository
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self):
        self.repository = user_repository

    async def create_user(self, db: AsyncSession, user_in: UserCreate) -> User:
        if await self.repository.get_by_email(db, user_in.email):
            raise ValueError("Email already registered")

        data = user_in.model_dump()
        data["hashed_password"] = hash_password(data.pop("password"))
        return await self.repository.create(db, data)   # dict form — schema has no hashed_password

    async def authenticate(
        self, db: AsyncSession, email: str, password: str
    ) -> User | None:
        user = await self.repository.get_by_email(db, email)
        if user is None:
            return None
        # verify_password returns (ok, new_hash) — never truth-test the tuple itself.
        ok, new_hash = verify_password(password, user.hashed_password)
        if not ok:
            return None
        if new_hash is not None:   # transparent migration off legacy bcrypt hashes
            user.hashed_password = new_hash
            await db.flush()
        return user

    async def update_user(
        self, db: AsyncSession, user_id: int, user_in: UserUpdate
    ) -> User | None:
        user = await self.repository.get(db, user_id)
        if user is None:
            return None

        data: dict[str, object] = user_in.model_dump(exclude_unset=True)
        if user_in.password:
            data["hashed_password"] = hash_password(data.pop("password"))
        return await self.repository.update(db, user, data)


user_service = UserService()
```

## API Endpoints

Use `Annotated` dependencies and a return type on every route — set `response_model=` only when the declared return type differs from what the function returns (see [`core-conventions.md`](core-conventions.md) § Return type or `response_model`; never both for the same class). Keep one HTTP operation per function.

```python
# api/v1/endpoints/users.py
from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import SessionDep
from app.api.security_deps import CurrentUserDep
from app.schemas.user import User, UserCreate, UserUpdate
from app.services.user_service import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_user(user_in: UserCreate, db: SessionDep) -> User:
    try:
        return await user_service.create_user(db, user_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/me")
async def read_current_user(current_user: CurrentUserDep) -> User:
    return current_user


@router.get("/{user_id}")
async def read_user(
    user_id: int, db: SessionDep, current_user: CurrentUserDep
) -> User:
    user = await user_service.repository.get(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}")
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: SessionDep,
    current_user: CurrentUserDep,
) -> User:
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    user = await user_service.update_user(db, user_id, user_in)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int, db: SessionDep, current_user: CurrentUserDep
) -> None:
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not await user_service.repository.delete(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
```

## Authentication & Authorization

Full coverage is split:

- [`authn.md`](authn.md) — password hashing (`pwdlib`), self-issued JWT (`PyJWT`), external OIDC token verification (rolled in-house), provider quick-start (Keycloak / Dex / Okta / Auth0 / Entra / Google), protected-routes patterns.
- [`authz.md`](authz.md) — coarse role / scope deps, fine-grained authz with **OpenFGA** (model, `check`/`batch_check`/`list_objects`/`list_users`, writing tuples, service-layer integration).

The modules that fall out of that reference for a project laid out like this template:

- `core/security.py` — `password_hash` (Argon2+bcrypt via `pwdlib`), `create_access_token`, JWT verification primitives.
- `core/oidc.py` — JWKS cache + `verify_oidc_token` when users come from an external IdP.
- `core/fga.py` — `OpenFgaClient` factory + `check` helper when permissions are relational.
- `api/deps.py` — `CurrentUserDep` (local JWT), `OIDCUserDep` (external), `require_active` / `require_superuser`, plus `require_permission("reader", "document:{document_id}")` for per-object guards.

Place all of these in `core/` (not `api/`) so they're testable without spinning up FastAPI.

## Testing

```python
# tests/conftest.py
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_db
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_session():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        # create_all is OK for ephemeral test DBs only — prod schema is Alembic's job.
        await conn.run_sync(SQLModel.metadata.create_all)

    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
```

```python
# tests/test_users.py
import pytest


@pytest.mark.asyncio
async def test_create_user(client):
    response = await client.post(
        "/api/v1/users/",
        json={
            "email": "test@example.com",
            "password": "testpass123",
            "name": "Test User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
```

## Common Pitfalls

- Running blocking DB drivers inside `async def` handlers — use an async driver or a plain `def` handler.
- Business logic inside route handlers — push it into `services/`.
- Direct ORM access in routes — go through repositories.
- Mutating `app.dependency_overrides` in tests without clearing it afterwards — leaks across tests.
- Forgetting a return type or `response_model` — loses Pydantic-side filtering and serialization.
