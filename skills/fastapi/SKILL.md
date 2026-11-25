---
name: fastapi
description: FastAPI best practices, conventions, and production project templates. Use when writing, reviewing, refactoring or testing FastAPI or Pydantic API code, when scaffolding a new FastAPI project, or when building any new Python HTTP/REST service (FastAPI is the house standard).
---

# FastAPI

FastAPI is the project standard for every HTTP service. A non-HTTP CLI uses `typer` (see `writing-python`).

Routing index. Each topic links to a reference with full patterns and code. New projects start at [`project-template.md`](references/project-template.md); day-to-day code-style rules live in [`core-conventions.md`](references/core-conventions.md).

Facts here are measured against fastapi 0.165.0, starlette 1.10.0, pydantic 2.14.4, uvicorn 0.54.0 (2026-11-24). FastAPI ships its own agent skill (`fastapi/.agents/skills/fastapi/` in fastapi/fastapi); where this skill says something different it says why (summary in § Where this skill differs from FastAPI's own).

## Scope routing

| If you're working on… | Read |
| --------------------- | ---- |
| **Day-to-day route / model / DI style** (`Annotated`, no `...`, `response_model`, async vs sync, `StrEnum`, no `RootModel`, one HTTP op per function, `fastapi` CLI) | [`core-conventions.md`](references/core-conventions.md) |
| **Parameter models** — `Annotated[Model, Query()]` / `Header()` / `Cookie()` / `Form()`, several per route, optional groups, `extra` across siblings | [`parameter-models.md`](references/parameter-models.md) |
| **Request body limits** — `max_body_size` on app / router / route, `form_limits` (fastapi ≥ 0.164 / 0.165) | [`core-conventions.md`](references/core-conventions.md) § Request body limits |
| **Scaffolding a new project** — layered layout, settings, repository/service/endpoint patterns, auth wiring | [`project-template.md`](references/project-template.md) |
| **Dependency injection** — `yield`/`scope`, sub-dependency chains, per-request caching + `use_cache=False`, `max_concurrency` (fastapi ≥ 0.163), sync deps cost a thread, class deps | [`dependencies.md`](references/dependencies.md) |
| **Testing** — which client runs the lifespan (`with TestClient`, `LifespanManager`), a per-test app and settings pinned before import, `dependency_overrides` vs `respx`, a real store, the error body, a live uvicorn for wire claims | [`testing.md`](references/testing.md) |
| **Production wiring** — lifespan (`@asynccontextmanager`, never `on_event`), graceful shutdown, DI via `app.state`, middleware (CORS → RequestID → Timing → Logging), `ContextVar`, hiding `/docs` in prod | [`production-patterns.md`](references/production-patterns.md) |
| **Exception handlers** — `DomainError` hierarchy, RFC 9457 Problem Details, `RequestValidationError` override, `RateLimitError` + `Retry-After` | [`exception-handlers.md`](references/exception-handlers.md) |
| **Health checks** — `/livez` + `/readyz`, healthy / degraded / unhealthy states, per-component reporting, `startup_complete` / `shutting_down` flags from lifespan | [`health-checks.md`](references/health-checks.md) |
| **Database** — SQLModel + asyncpg + `AsyncEngine`, pool flags (`pool_pre_ping`, `pool_recycle`), sizing formula, PgBouncer, **Alembic migrations** (env.py for SQLModel, k8s `initContainer`, data-migration batching) | [`database.md`](references/database.md) |
| **Pagination** — offset / cursor / keyset, reusable `PaginationParams`, generic `Page[Item]` (PEP 695), filter+sort+pagination, index requirements, `MAX_OFFSET` | [`pagination.md`](references/pagination.md) |
| **Caching** — `cache_aside` for service methods, mutation→invalidation, lifespan warming, why-not response-cache middleware | [`cache.md`](references/cache.md) |
| **Redis (design choice + wiring hub)** — when to add Redis vs NATS/Postgres, shared `make_redis` + `RedisDep`, JWT `jti` revocation, single-process SSE pub/sub, distributed lock | [`redis.md`](references/redis.md) |
| **Rate limiting** — `slowapi` per-route (not global middleware), Redis-backed (slowapi opens its own sync client, not `app.state.redis`), key by `user_id` not IP; mandatory on `/login`, `/token`, `/forgot-password` | [`rate-limiting.md`](references/rate-limiting.md) |
| **WebSockets** — authn BEFORE `accept()`, `ConnectionManager` on `app.state`, server-side heartbeat, NATS JetStream for horizontal scaling, manual OTel spans; prefer SSE for one-way push | [`websockets.md`](references/websockets.md) |
| **File handling** — `FileResponse` (path-traversal guard), `StreamingResponse` for generated content, HTTP-range for video / resumable, `UploadFile` chunked reads, temp-file cleanup | [`file-handling.md`](references/file-handling.md) |
| **Streaming** — JSON Lines, Server-Sent Events (`EventSourceResponse`, `ServerSentEvent`), byte streams | [`streaming.md`](references/streaming.md) |
| **Authentication** — _who is the request?_ — pwdlib (Argon2 + bcrypt), self-issued JWT with PyJWT, OIDC verification (Keycloak/Dex/Okta/Auth0/Entra/Google), protected-route patterns | [`authn.md`](references/authn.md) |
| **Authorization** — _what may they do?_ — coarse role/scope deps, **OpenFGA** (Zanzibar-style) for fine-grained relational permissions | [`authz.md`](references/authz.md) |
| **Observability** — FastAPI ≥ 0.142 has NATIVE OpenTelemetry, on by default; how it yields to `FastAPIInstrumentor`, `telemetry={...}`, excluded URLs, manual business spans. SDK setup defers to the `otel` skill | [`observability.md`](references/observability.md) |
| **Kubernetes deployment** — one worker per pod (never gunicorn), full Deployment YAML, PodDisruptionBudget, HPA on RPS, `terminationGracePeriodSeconds` math, `preStop` sleep, **Dapr sidecar interplay** cross-link | [`kubernetes.md`](references/kubernetes.md) |
| **Microservices** — when to split, one-DB-per-service, sync (httpx ≤2 hops) vs async (NATS JetStream or Dapr pub/sub on JetStream), outbox via Dapr Workflow, trace context propagation, service-to-service authn, contract sharing, **Dapr + Kubernetes interplay** | [`microservices.md`](references/microservices.md) |
| **Anti-patterns** — quick-lookup table of ~50 common mistakes (blocking I/O in `async def`, deprecated APIs, `engine = create_engine(...)` at import, mocking the DB, etc.) | [`anti-patterns.md`](references/anti-patterns.md) |

## OpenAPI / docs flags (the only inline rule)

Two per-route flags worth knowing inline (everything else auto-derives from types): **`include_in_schema=False`** hides internal endpoints from `/docs`; **`deprecated=True`** strikethroughs during a deprecation window. Prod-wide `docs_url=None` / `openapi_url=None` lives in [`production-patterns.md`](references/production-patterns.md).

## Tooling & libraries

Single source of truth in sibling skills + linked references: **`uv` / `ruff` / `ty`** (`writing-python` + `astral:*`), **`SQLModel`** over SQLAlchemy ([`database.md`](references/database.md)), **`HTTPX`** over requests (lifespan + `HttpDep` in [`production-patterns.md`](references/production-patterns.md)), **`PyJWT`** over python-jose, **`pwdlib`** over passlib ([`authn.md`](references/authn.md)). Sync↔async: `asyncer.asyncify` or `fastapi.concurrency.run_in_threadpool` — one per project, both use anyio's thread limiter ([`production-patterns.md`](references/production-patterns.md) § Bridging sync ↔ async).

**Turn on ruff's FastAPI and async rules** [upstream: `references/other-tools.md` "Consider enabling the FastAPI rules"]: `extend-select = ["FAST", "ASYNC"]`. FAST001 refuses a `response_model=` that restates the return annotation, FAST002 the default-value `Depends`/`Query` form, FAST003 a path parameter the function never takes; ASYNC catches `open`, `time.sleep`, sync HTTP inside `async def`. Measured on ruff 0.16.0 and 0.17.6 with ruff's own example: FAST001 fires only at a py313 or lower target and only in a module without `from __future__ import annotations`; at a py314+ target, where annotations are lazy, it fires nowhere, so on a 3.14+ floor a `response_model=` that restates the return type is a review item. ASYNC sees only the call written in the `async def` body, never a blocking helper it calls.

**API clients** [upstream: `SKILL.md` Quick Reference]: generate a client from the app's OpenAPI schema, regenerate it when the schema changes, never hand-edit the generated file. Commit the schema (`app.openapi()` dumped with sorted keys) and fail CI on drift.

## Cross-skill boundaries

- **`writing-python`** — language style, type safety, Pydantic, uv/ruff/ty, and one test (`references/testing.md`: what earns a test its place, doubles, the async decorators). This skill — _what changes when the code is a FastAPI route_; its [`testing.md`](references/testing.md) is only what changes for a FastAPI app.
- **`testing-python`** — the suite as a whole: markers, parallel runs, the red-check recipe, pruning.
- **`python-infrastructure`** — NATS JetStream consumers, Dapr Workflow, retry/backoff, OTel conventions, Redis fundamentals. This skill links out for the cross-cutting concerns.
- **`otel`** — full OTel SDK reference. [`observability.md`](references/observability.md) only pins the FastAPI-specific bits on top.

## Where this skill differs from FastAPI's own

Deliberate house rules, each restated where it applies:

- **Deployment** — Kubernetes, uvicorn, one worker per pod ([`kubernetes.md`](references/kubernetes.md)). Upstream points at FastAPI Cloud and `fastapi run`; its `fastapi-cloud.md` is not taken.
- **Class dependencies** — a Pydantic `BaseModel`, not upstream's `@dataclass` ([`dependencies.md`](references/dependencies.md) § Class Dependencies).
- **Streaming** — return `StreamingResponse` directly when the producer can fail; a measured exception to upstream's "prefer `yield`" ([`streaming.md`](references/streaming.md)).
- **Sync ↔ async** — `asyncify` or `run_in_threadpool`, one per project; upstream prefers Asyncer ([`production-patterns.md`](references/production-patterns.md) § Bridging sync ↔ async).
- **OpenTelemetry** — native or contrib, one per app; upstream prefers native ([`observability.md`](references/observability.md)).
- **`app.frontend()` / `router.frontend()`** — not a house default. If FastAPI serves a built frontend, use it instead of mounting `StaticFiles` by hand.

## Top gotchas

- **Blocking I/O in `async def`** kills throughput. If in doubt use plain `def` — FastAPI runs it in a threadpool. See [`core-conventions.md`](references/core-conventions.md) § Async vs sync.
- **One body cap for every route is too big for most of them.** A JSON body is parsed with `json.loads` on the event loop: measured 117 ms for 65 MiB, and the objects it builds are several times the body. Set a small app `max_body_size` and raise it only on the upload routes. See [`core-conventions.md`](references/core-conventions.md) § Request body limits.
- **A handler for `Exception` (or 500) re-raises.** Starlette installs it on `ServerErrorMiddleware`, which sends your answer and then raises again "so servers can log the error" — uvicorn logs a second traceback for every one. Expected failures get a handler on their own class. See [`exception-handlers.md`](references/exception-handlers.md).
- **`engine = create_engine(...)` at import time** breaks tests and leaks resources. Always build in lifespan. See [`production-patterns.md`](references/production-patterns.md) § Lifespan.
- **`--workers N` inside a Kubernetes pod** multiplies pools and lifespan runs. One worker per pod, scale via `replicas:`. See [`kubernetes.md`](references/kubernetes.md) § Process model.
- **`BackgroundTasks` for anything you'd page on** dies with the worker. Use NATS JetStream or Dapr Workflow. See [`anti-patterns.md`](references/anti-patterns.md).
- **Authenticate WebSockets before `accept()`** — otherwise the socket is open and counted before you reject. See [`websockets.md`](references/websockets.md).
- **`AsyncClient(transport=ASGITransport(app=app))` never runs the lifespan**, and neither does `TestClient(app)` without `with`. Everything the lifespan builds is missing from `app.state`. See [`testing.md`](references/testing.md) § Pick the client.
