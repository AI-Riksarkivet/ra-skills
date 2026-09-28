# Dependency Injection

## Contents

- Dependencies with `yield` and `scope`
- Sub-dependency chains
- Per-request caching (and `use_cache=False`)
- Class dependencies
- Overriding dependencies in tests

## Dependencies with `yield` and `scope`

When using dependencies with `yield`, they can have a `scope` that defines when the exit code is run.

Use the default scope `"request"` to run the exit code after the response is sent back. The canonical example is the `get_db` / `SessionDep` session dependency — it yields the session, commits on success, rolls back on error, all under the default `"request"` scope. Its code lives in one place: `production-patterns.md` § Dependency injection from `app.state`.

```python
from app.api.deps import SessionDep   # get_db: production-patterns.md § DI from app.state


@app.get("/items/")
async def read_items(db: SessionDep):
    result = await db.exec(select(Item))
    return result.all()
```

Use the scope `"function"` when they should run the exit code after the response data is generated but before the response is sent back to the client.

```python
from typing import Annotated

from fastapi import Depends, FastAPI

app = FastAPI()


def get_username():
    try:
        yield "Rick"
    finally:
        log.info("cleanup before response is sent")

UserNameDep = Annotated[str, Depends(get_username, scope="function")]

@app.get("/users/me")
def get_user_me(username: UserNameDep):
    return username
```

## Sub-dependency chains

Dependencies can declare their own dependencies. FastAPI resolves the whole graph and passes everything down with one cached lookup per request.

```python
from typing import Annotated
from fastapi import Depends, Header, HTTPException

from app.api.deps import SessionDep                    # AsyncSession dep
from app.services.users import UserService             # plain class


def get_user_service(db: SessionDep) -> UserService:
    return UserService(db)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]


async def get_current_user(
    svc: UserServiceDep,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization:
        raise HTTPException(401, "Missing Authorization header")
    return await svc.get_by_token(authorization.removeprefix("Bearer "))


CurrentUserDep = Annotated[User, Depends(get_current_user)]
```

`CurrentUserDep` transitively depends on `SessionDep` via `UserServiceDep` — declare it on a route and the whole chain materializes. See `authn.md` for the full JWT / OIDC variants.

## Per-request caching (and `use_cache=False`)

Same `Depends(x)` referenced N times in a single request → `x` runs **once**. The result is cached per `(request, dep)` pair. This is why `SessionDep` and `CurrentUserDep` are cheap to compose — there's only one session, one user lookup, no matter how many sub-deps reach for them.

Override with `use_cache=False` only when you genuinely need a **fresh** instance per call site (rare — usually a sign you should restructure):

```python
from fastapi import Depends


def fresh_uuid() -> str:
    return uuid.uuid4().hex


@app.get("/two-ids")
async def two_ids(
    a: Annotated[str, Depends(fresh_uuid, use_cache=False)],
    b: Annotated[str, Depends(fresh_uuid, use_cache=False)],
) -> dict[str, str]:
    return {"a": a, "b": b}    # different uuids
```

Without `use_cache=False`, `a == b`.

## Class Dependencies

Avoid creating class dependencies when possible.

If a class is needed, instead create a regular function dependency that returns a class instance.

Do this:

```python
from typing import Annotated

from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field

app = FastAPI()


class DatabasePaginator(BaseModel):
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=1000)
    q: str | None = None

    def get_page(self) -> dict:
        return {"offset": self.offset, "limit": self.limit, "q": self.q, "items": []}


def get_db_paginator(
    offset: int = 0, limit: int = 100, q: str | None = None
) -> DatabasePaginator:
    return DatabasePaginator(offset=offset, limit=limit, q=q)


PaginatorDep = Annotated[DatabasePaginator, Depends(get_db_paginator)]


@app.get("/items/")
async def read_items(paginator: PaginatorDep):
    return paginator.get_page()
```

instead of this:

```python
# DO NOT DO THIS
from typing import Annotated

from fastapi import Depends, FastAPI

app = FastAPI()


class DatabasePaginator:
    def __init__(self, offset: int = 0, limit: int = 100, q: str | None = None):
        self.offset = offset
        self.limit = limit
        self.q = q

    def get_page(self) -> dict:
        # Simulate a page of data
        return {
            "offset": self.offset,
            "limit": self.limit,
            "q": self.q,
            "items": [],
        }


@app.get("/items/")
async def read_items(paginator: Annotated[DatabasePaginator, Depends()]):
    return paginator.get_page()
```

## Overriding dependencies in tests

`app.dependency_overrides`, the client that runs the lifespan, and when to use `respx` instead of an
override: [`testing.md`](testing.md) § Overriding dependencies.
