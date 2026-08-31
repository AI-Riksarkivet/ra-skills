---
name: testing-python
description: pytest in the rask monorepo — the non-default config (importlib import-mode, explicit testpaths, the 'slow' marker, explicit @pytest.mark.asyncio), running single tests, moto for S3, respx for HTTPX. Use when writing or running Python tests in rask, debugging collection/import errors, marking slow model-loading tests, or wiring async/DB/S3/HTTP fixtures.
---

# Testing (pytest in rask)

rask's pytest config has several **non-default** choices. Get them wrong and tests
either don't collect or behave differently than the writing-python reference implies.
This skill is the rask-specific layer; the generic pytest craft (FIRST, boundary
conditions, parametrize, one-concept-per-test, respx side-effects) lives in
`writing-python` → `references/testing.md` — read that for technique, this for **how rask is wired**.

## When to use

- Writing a test for anything under `packages/`, `services/`, or the top-level `tests/`.
- A test won't collect, or `import` fails only under pytest.
- You need to mark a test that loads real models / is slow.
- Writing an `async def` test, or an async DB / S3 / HTTPX fixture.
- Running one test, or skipping the slow ones, from the CLI.

## The rask config (verified against root `pyproject.toml` `[tool.pytest.ini_options]`, 2026-08-31)

```toml
testpaths = [                       # 21 paths — two planes plus the top-level suites
  "packages/lineage-kit/tests", "packages/ray-kit/tests", "packages/service-kit/tests",
  "packages/storage/tests", "packages/validate/tests",
  "services/annotator/tests", "services/catalog/tests", "services/compute/tests",
  "services/controlplane/tests", "services/flows/tests", "services/gateway/tests",
  "services/ingest/tests", "services/lineage/tests", "services/maintenance/tests",
  "services/medallion/tests", "services/notifications/tests", "services/search/tests",
  "services/viewer/tests",
  "tests/unit", "tests/integration", "tests/e2e-py",
]
addopts = "--import-mode=importlib"
```

**There is no coverage in `addopts`.** `--cov` is passed per-invocation when wanted, not by default —
do not expect a coverage table from a bare `uv run pytest`.

**There is no `asyncio_mode` setting.** That part still holds — see "Async is explicit" below.

**There are SIXTEEN markers, not one.** `slow` plus `e2e` and fourteen per-suite e2e selectors:
`auth`, `cas`, `compaction`, `duckdb`, `dummy_lane`, `gateway`, `governed_union`, `medallion`,
`media`, `media_catalog`, `observability`, `ray_batch`, `ray_train`, `user_state`. The e2e family
needs a running or deployed stack and is deselected with `-m "not e2e"`; the per-suite make targets
(`make e2e-ci` and friends) select them individually.

`tests/integration` IS a testpath — an `integration` MARKER is still not defined, and the distinction
matters: integration tests are selected by PATH, e2e tests by MARKER.

## Load-bearing rules

- **`--import-mode=importlib`** — tests are imported as top-level modules, not via
  `sys.path` insertion of `rootdir`. Consequence: **no `__init__.py`-implied package
  paths between test dirs**, and two `test_foo.py` files in different bricks won't
  collide. It also means **`testpaths` is an explicit all-list, not discovery** — a new
  brick's `tests/` dir runs *only after you add its path to `testpaths`*. Adding a workspace
  member (uv + `package.json`) does **not** auto-enroll its tests.
- **`slow` marks "needs real models or a long runtime"; the `e2e` family marks "needs a live stack".**
  Decorate model-loading / long tests with `@pytest.mark.slow` and keep a cheap non-slow sibling that
  checks shape without the load. Run `uv run pytest -m "not slow"` to skip them; CI's fast lane uses
  exactly that, and `make test` is that command. The e2e markers are a separate axis — a suite can be
  neither, either, or both.
- **Async is explicit, not auto.** rask does **not** set `asyncio_mode = "auto"`. Every
  coroutine test needs `@pytest.mark.asyncio`; every async fixture needs `@pytest_asyncio.fixture`
  (plain `@pytest.fixture` on an async fn yields a coroutine, not the value). The `asyncio_mode="auto"`
  toml snippet in the writing-python reference is a generic example — **rask does not use it**.
  Live examples: `services/ingest/tests/test_worker_queue.py` and `test_broker_connect_is_bounded.py`.
  There is no async-DB fixture to copy — rask has no application relational database (the batches
  table, Alembic and `DATABASE_URL` died at P7a); the only Postgres left is chart-managed lineage
  (AGE) and OpenFGA, which tests do not open sessions against.
- **Single test:** `uv run pytest services/medallion/tests/test_stage_workflow.py::test_name`.
  By name across paths: `uv run pytest -k <pattern>`. Always `uv run pytest`, never `uvx pytest`
  (pytest must import from the workspace venv).
- **A sealed runner's tests run in NEITHER.** `runners/*` is matched by no workspace glob and appears
  in no testpath, so `make test` names its runners by hand and `dagger call test` runs the root
  testpaths only. Tests you add under `runners/<name>/` execute in no CI job unless someone wires them.
- **Config-isolation fixture.** Settings are validated at import, so a suite that builds a real app
  pins the env it needs. The pattern to copy is `packages/service-kit/tests/conftest.py`: an
  `autouse` fixture that `monkeypatch.setenv`s each required variable, defaulting from the ambient
  environment so a developer's own value still wins. Note what it does NOT do — it deliberately does
  not pin `RASK_API_PREFIX`, because tests resolve the prefix from `build_settings().api_prefix`
  rather than asserting a literal.
- **Bound any timeout a test can wait on.** The same conftest caps the OTLP export timeout, and the
  reason generalises: `test_otel.py` builds REAL exporters against an endpoint nothing serves, and
  `atexit` shutdown hooks then wait out the SDK's 10 s default per attempt at process exit. Measured:
  3.22 s → 10.19 s once the hooks landed, back to 3.08 s with the cap. That failure mode does not go
  red — the suite simply sleeps, which is far harder to notice than a failure.

## Doubles for the external surface

- **S3 → `moto`.** `from moto import mock_aws`; wrap real boto/`storage` calls in `with mock_aws():`
  (see `packages/storage/tests/test_storage.py`, `test_iiif.py`). `moto[s3]` is a dev dep. New code
  uses `storage.s3_client`, not raw boto3 — but the moto tests construct a boto client directly to
  *seed* the mock bucket, which is fine inside the test.
- **Ray client → a hand-rolled structural fake**, `cast` to the real type. `_FakeRayClient` /
  implement only the methods under test — `submit_job`/`stop_job`/`list_jobs` — then
  `cast("JobSubmissionClient", fake)` keeps the signature honest with zero Ray import. `cast`, never
  `# type: ignore`: rask type-checks with `ty`, which does not honour mypy's suppression syntax.
- **FastAPI app → `TestClient(create_app())`** inside a fixture that `yield`s the client
  Drive HTTP at the boundary;
  assert on the RFC-7807-ish body (`status`, `title`, `errors`).
- **Outbound HTTPX → `respx`** (transport-layer, not `@patch`). rask doesn't use respx in-tree *yet*,
  but it's the prescribed tool for any new code that calls an external HTTP API. Full recipe +
  side-effects + assertions: `writing-python` → `references/testing.md` § "Mocking HTTPX with respx".

## References

- `references/rask-recipes.md` — copy-paste fixtures for the async-sqlite session, the seeded-`Batch`
  TestClient app, the moto-S3 round-trip, and the structural Ray fake, with the exact imports rask uses.
- `writing-python` → `references/testing.md` — generic pytest craft: parametrize, respx, FIRST,
  boundary/near-bug testing, skip/xfail discipline. **Don't duplicate it here.**
