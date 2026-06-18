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

- Writing a test for any brick under `packages/` or `components/`.
- A test won't collect, or `import` fails only under pytest.
- You need to mark a test that loads real models / is slow.
- Writing an `async def` test, or an async DB / S3 / HTTPX fixture.
- Running one test, or skipping the slow ones, from the CLI.

## The rask config (verified in root `pyproject.toml` `[tool.pytest.ini_options]`)

```toml
testpaths = ["packages/htr/tests", "packages/storage/tests",
             "components/services/core/tests", "components/apps/runner/tests",
             "components/services/volumes_api/tests", "components/services/search_api/tests",
             "components/services/ray_api/tests"]
addopts  = "--cov --cov-report=term-missing:skip-covered --import-mode=importlib"
markers  = ["slow: marks tests requiring real models or long runtimes (deselect with '-m \"not slow\"')"]
```

There is **no `asyncio_mode`** setting. There is **no `integration` marker**. Don't add them.

## Load-bearing rules

- **`--import-mode=importlib`** — tests are imported as top-level modules, not via
  `sys.path` insertion of `rootdir`. Consequence: **no `__init__.py`-implied package
  paths between test dirs**, and two `test_foo.py` files in different bricks won't
  collide. It also means **`testpaths` is an explicit all-list, not discovery** — a new
  brick's `tests/` dir runs *only after you add its path to `testpaths`*. Adding a workspace
  member (uv + `package.json`) does **not** auto-enroll its tests.
- **`slow` is the only custom marker.** Decorate model-loading / long tests with
  `@pytest.mark.slow` (e.g. `packages/htr/tests/test_layout_actor.py::test_layout_actor_smoke`
  loads real YOLO weights). Keep a cheap non-slow sibling that checks shape without the load
  (that file's `test_layout_actor_signature` bypasses `__init__`). Run `uv run pytest -m "not slow"`
  to skip them; CI's fast lane uses exactly that.
- **Async is explicit, not auto.** rask does **not** set `asyncio_mode = "auto"`. Every
  coroutine test needs `@pytest.mark.asyncio`; every async fixture needs `@pytest_asyncio.fixture`
  (plain `@pytest.fixture` on an async fn yields a coroutine, not the value). The `asyncio_mode="auto"`
  toml snippet in the writing-python reference is a generic example — **rask does not use it**.
  Pattern: `test_pipelines_registry.py` — `@pytest_asyncio.fixture async def session()` builds a
  `create_async_engine("sqlite+aiosqlite://")` in-memory DB, and each test is `@pytest.mark.asyncio`.
- **Single test:** `uv run pytest packages/htr/tests/test_geometry.py::test_bbox_dimensions`.
  By name across paths: `uv run pytest -k bbox`. Always `uv run pytest`, never `uvx pytest`
  (pytest must import from the workspace venv).
- **Config-isolation fixture.** `core.main.create_app()` calls `load_dotenv()`, so the suite
  pins env to stay hermetic: `core/tests/conftest.py` has an `autouse` fixture setting
  `RASK_API_PREFIX=/api/v1`, and the per-test `app` fixtures `monkeypatch.setenv` the
  `RASK_VIEWER_INPUT/OUTPUT`, `RASK_BATCHES_DB`, `RAY_DASHBOARD_URL` and `delenv("HCP_ENDPOINT")`.
  Copy that shape for any test that builds a real app.

## Doubles for the external surface

- **S3 → `moto`.** `from moto import mock_aws`; wrap real boto/`storage` calls in `with mock_aws():`
  (see `packages/storage/tests/test_storage.py`, `test_iiif.py`). `moto[s3]` is a dev dep. New code
  uses `storage.s3_client`, not raw boto3 — but the moto tests construct a boto client directly to
  *seed* the mock bucket, which is fine inside the test.
- **Ray client → a hand-rolled structural fake**, `cast` to the real type. `_FakeRayClient` /
  `_FakeDeriveClient` in `test_pipelines_registry.py` implement only `submit_job`/`stop_job`/`list_jobs`,
  then `cast(JobSubmissionClient, fake)` keeps the signature honest with zero Ray import.
- **FastAPI app → `TestClient(create_app())`** inside a fixture that `yield`s the client
  (`test_chunk_submit_endpoint.py`, `search_api/tests/test_search.py`). Drive HTTP at the boundary;
  assert on the RFC-7807-ish body (`status`, `title`, `errors`).
- **Outbound HTTPX → `respx`** (transport-layer, not `@patch`). rask doesn't use respx in-tree *yet*,
  but it's the prescribed tool for any new code that calls an external HTTP API. Full recipe +
  side-effects + assertions: `writing-python` → `references/testing.md` § "Mocking HTTPX with respx".

## References

- `references/rask-recipes.md` — copy-paste fixtures for the async-sqlite session, the seeded-`Batch`
  TestClient app, the moto-S3 round-trip, and the structural Ray fake, with the exact imports rask uses.
- `writing-python` → `references/testing.md` — generic pytest craft: parametrize, respx, FIRST,
  boundary/near-bug testing, skip/xfail discipline. **Don't duplicate it here.**
