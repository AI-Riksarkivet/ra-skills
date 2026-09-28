# Testing a FastAPI app

What changes when the code under test is a FastAPI app. Generic pytest craft (what earns a test,
tiers, doubles, the async decorators) is in `writing-python` → `references/testing.md`. A project's own
test wiring is in its project skill (rask: `testing-python`).

## Contents

- Drive the app at the HTTP door
- Pick the client, and run the lifespan
- Build the app per test
- Overriding dependencies
- The store is real
- Assert the error body
- A real server, when the claim is about the wire

## Drive the app at the HTTP door

Test a route through its URL and assert the status, the body and the headers the caller reads. Test a
pure service or domain function directly, without FastAPI.
Why: calling the endpoint function directly skips request validation, dependency resolution, the
exception handlers and response serialization. Those are where FastAPI bugs live.

## Pick the client, and run the lifespan

The lifespan builds the app's resources (engines, HTTP clients, SDK clients; see
[`production-patterns.md`](production-patterns.md) § Lifespan). Two of the common client forms never
run it. Measured with a lifespan that sets `app.state.engine` and yields `{"pool": ...}` (fastapi
0.140.13, starlette 1.3.1, httpx 0.28.1, asgi-lifespan 2.1.0):

| Client                                                                                      | `app.state` set in lifespan | yielded state on `request.state` |
| ------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------- |
| `with TestClient(app) as c:`                                                                | yes                         | yes                              |
| `TestClient(app)` with no `with`                                                            | **no**                      | **no**                           |
| `AsyncClient(transport=ASGITransport(app=app))`                                             | **no**                      | **no**                           |
| `ASGITransport(app=app)` inside `async with app.router.lifespan_context(app)`               | yes                         | **no**                           |
| `ASGITransport(app=manager.app)` inside `async with LifespanManager(app) as manager`         | yes                         | yes                              |

Without the lifespan, the test fails with an `AttributeError` far from the cause, or it passes against
a fallback path production never takes.

- **Default: `with TestClient(app) as client`** in a sync test. It runs startup and shutdown and needs
  no async plumbing.
- **When the test itself must be async** (it awaits something besides the client), use
  `httpx.AsyncClient` over `ASGITransport` inside `asgi_lifespan.LifespanManager`, and pass
  `manager.app` to the transport. `manager.app` carries the lifespan state.

```python
from collections.abc import AsyncIterator, Iterator

import httpx
import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as c:  # the `with` runs the lifespan
        yield c


@pytest_asyncio.fixture
async def aclient(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with LifespanManager(app) as manager:
        transport = httpx.ASGITransport(app=manager.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


@pytest.mark.asyncio
async def test_readiness_reports_ready(aclient: httpx.AsyncClient) -> None:
    r = await aclient.get("/readyz")
    assert r.json() == {"status": "ready"}
```

`@pytest_asyncio.fixture` and `@pytest.mark.asyncio` are required under pytest-asyncio's default
strict mode. See `writing-python` → `references/testing.md` § Async.

## Build the app per test

Prefer a factory, `create_app(settings: Settings) -> FastAPI`, and a function-scoped `app` fixture that
builds it from test settings. Each test then gets its own `dependency_overrides`, `app.state` and
settings.

When the app is built at import (`app = FastAPI(...)` in `main.py`, with settings read at module level,
as in [`project-template.md`](project-template.md)):

- **Pin the environment before the first import of the app module.** Use `monkeypatch.setenv`, clear
  the settings cache, then import inside the fixture.
- **Module-level reads happen once per process**, at first import: the router prefix, CORS origins,
  anything computed from `settings` at module level. A test that needs a different value must
  `importlib.reload` the module. Otherwise it gets whichever values the first importer pinned.
- **Pin every key the settings class requires.** Environment variables win over `env_file=".env"`, but
  a key you leave unset falls through to the developer's own `.env`.

```python
@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    monkeypatch.setenv("DATABASE_URL", test_database_url)
    monkeypatch.setenv("SECRET_KEY", "test")
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.main import app

    yield app
    app.dependency_overrides.clear()
    get_settings.cache_clear()
```

## Overriding dependencies

`app.dependency_overrides[original] = replacement` swaps a dependency for the whole app, with no
monkeypatching of internals.

```python
@pytest.fixture
def client(app: FastAPI, user: User) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- **Key on the registered callable**: the function passed to `Depends(...)` (`get_current_user`),
  not an `Annotated` alias.
- **Clear in teardown.** `dependency_overrides` is a dict on the app object, so an override outlives
  the test that set it.
- **Pick the layer:**
  - Override the dependency itself for an identity, a permission decision, or a session factory
    pointed at the test store.
  - Keep the real dependency and intercept the network with `respx` when the route calls an external
    HTTP API. The real `httpx.AsyncClient` from `HttpDep`, with its URL building, headers and retry
    policy, still runs. See `writing-python` → `references/testing.md` § Mocking HTTPX with `respx`.
    `respx` is test-only.
- A module-level rate limiter (slowapi) is switched off in tests with `limiter.enabled = False`, and
  switched back on at teardown. See [`rate-limiting.md`](rate-limiting.md).

## The store is real

Run the test against a real, throwaway instance of the engine production uses: a testcontainers
Postgres for a Postgres app, a `tmp_path` directory for a file-backed store, a local server for an
object store. Override the session or engine dependency to point at it. Don't override it with a mock,
and don't swap in a different engine (sqlite for a Postgres app).
Why: a mock or a different engine agrees with your assumptions, not with the database. `ON CONFLICT`,
JSONB, transaction isolation and type coercion differ, and the divergence surfaces in production.
Schema: `SQLModel.metadata.create_all` is acceptable for a throwaway test schema only. Production
schema comes from Alembic ([`database.md`](database.md)).

## Assert the error body

For an error path, assert the media type and the fields the client reads, not only the status.

```python
r = client.post("/api/v1/items", json={"name": 7})
assert r.status_code == 422
assert r.headers["content-type"] == "application/problem+json"
body = r.json()
assert body["title"] == "Validation Error"
assert [e["field"] for e in body["errors"]] == ["body.name"]
```

The envelope above is the `RequestValidationError` handler in
[`exception-handlers.md`](exception-handlers.md). Assert the fields your handlers install.

## A real server, when the claim is about the wire

`TestClient` and `ASGITransport` call the ASGI app in-process: no socket, no HTTP parser, no server
limits. When the claim depends on the server (streaming and client disconnects, timeouts, header or
body limits, how a real request's query string and body are parsed), run uvicorn on port 0 in a thread:

```python
import threading
import time

import httpx
import uvicorn


@pytest.fixture
def live_url(app: FastAPI) -> Iterator[str]:
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError("uvicorn did not start")
        time.sleep(0.01)
    port = server.servers[0].sockets[0].getsockname()[1]
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=10)


def test_ping_over_a_socket(live_url: str) -> None:
    assert httpx.get(f"{live_url}/ping", timeout=5).json() == {"pong": "yes"}
```

uvicorn runs the lifespan itself (`lifespan="auto"` by default).
