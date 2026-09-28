---
name: testing-python
description: rask's test policy and pytest wiring — which test to write (integration keepers, unit tests only for pure branches, the red check, one test per closes-when clause), what stands in for Lance/S3/NATS/Ray/OpenFGA, and which lane runs what. Use before writing, changing or deleting a test in rask, when pruning tests, or when a test does not collect or runs in no lane.
---

# Testing in rask

Generic pytest craft (what a test is for, fixtures, doubles, async decorators, parametrize, names,
waits, skips) is in `writing-python` → `references/testing.md`. A FastAPI door's client and lifespan
are in `fastapi` → `references/testing.md`. This skill is rask's policy and wiring on top of those.

## Writing or changing a test

1. **Find the test that already drives the seam**:
   `git grep -l '<symbol>' -- ':(glob)packages/*/tests/**' ':(glob)services/*/tests/**' tests`. The
   `:(glob)` form is needed: without it, `packages/*/tests` silently matches nothing. Test files are
   named per claim, not per module, so the file name will not lead you there. Change that test. Add a
   new one only when no test drives the seam.
   Done when: you can name the test you are changing or replacing, or you have shown that none exists.
2. **Pick the tier by what the claim touches.**
   - **Integration is the keeper.** Use the real app over HTTP (`with TestClient(app)`), real pylance
     on `tmp_path` or on a moto server, a real uvicorn socket when the claim is about the wire, or
     several services in one flow.
   - **Unit** only for a pure function's distinct branches: no I/O, no app, milliseconds.
   - A unit test that covers what an integration test covers is **deleted**, not kept beside it.
   - **e2e** (`tests/e2e-py`, marker `e2e`) only for claims that need a deployed stack or the
     Dagger-hosted Dex and OpenFGA.
3. **Make it red**, once, at write time: revert the fix (for new behaviour, break the line the test is
   about), watch the test fail on the assertion that names the bug, restore. The recipe is in
   `references/rask-fixtures.md` § The red check.
   Done when: the test is red with the fix reverted and green with it, and no other test went red on
   the revert. If another test did go red, one of the two is redundant; keep the integration one.
4. **Count.** Add at most one test per closes-when clause of the change, and state the net test delta
   (`tests: +N −M`) in the commit message.

## What is never a test

- **Source text, an AST, prose, or file names.** A rule about code shape (a banned import or
  decorator, a layer boundary) is a ruff `banned-api` rule or an import-linter contract in
  `pyproject.toml`, or it is nowhere. Why: `writing-python` → `references/testing.md` § What a test is
  for, rule 3. Rendering the chart with `helm template` and asserting on the manifest runs the product.
  That is a test.
- **An absence.** A test that asserts a deleted file, name or sentence is gone checks nothing that
  runs. Delete the code, and let the linter or the import error guard it.

## Wiring the config does not state

Read `[tool.pytest.ini_options]` in the root `pyproject.toml` for the current values. These are the
consequences it does not spell out.

- **`testpaths` is an explicit list.** A new `tests/` directory runs only after you add it there.
  Enrolling a workspace member does not enrol its tests.
- **`--import-mode=importlib`: test directories are not packages.** Share a fixture through the
  directory's `conftest.py`, and a helper through a plain module (`tests/unit/chart_render.py` is the
  model). The `from test_invariants import ...` lines in `tests/unit` resolve only because
  `tests/unit/conftest.py` inserts that directory into `sys.path`. Don't add another; move the helper
  into a plain module.
- **Markers.** `slow` means real models or a long runtime. `e2e` means a live stack:
  `tests/e2e-py/conftest.py` applies it to everything collected there, and each per-suite selector
  (`auth`, `media`, ...) rides on top of it. When you add or use a marker, run with `--strict-markers`.
- **Lanes.** `make test` runs `-m "not slow and not e2e"` at `-n 16`, then the `runners/htr` and
  `runners/dummy` suites. `PYTEST_WORKERS=0` gives one process and a readable traceback. CI
  (`dagger call test`, `.dagger/test.go`) runs the same marker filter serially, with
  `--timeout=300` and a real NATS bound, and runs **no** runner suite. A test under any other
  `runners/<name>/` runs in no lane until someone wires it.
- **Async is strict.** No `asyncio_mode` is set, so use the explicit form in `writing-python` →
  `references/testing.md` § Async. The `anyio` plugin is also loaded, but new tests use
  pytest-asyncio.
- **Services build `app` at module import** (ingest alone has a `create_app()` factory), so the
  first import fixes whatever the module reads at that point. The fixture depends on how settings
  reach the app (`references/rask-fixtures.md` § A service app):
  - Read once at import (`make_service_app`'s `build_settings()`; the gateway's
    `build_gateway_settings()`): set env around the first import and hand it back, or
    `importlib.reload` under `monkeypatch.setenv`.
  - Through an `lru_cache`d `get_*settings()` (the lance-plane and media services): pin env,
    `cache_clear()`, import inside the fixture. Copy `tests/integration/conftest.py::real_ns_client`.
- **Bound every wait.** A real OTLP exporter against a dead endpoint waits 10 s per attempt at process
  exit, so `packages/service-kit/tests/conftest.py` caps `OTEL_EXPORTER_OTLP_TIMEOUT` (measured:
  10.19 s → 3.08 s). A new suite that builds real exporters needs the same cap.

## What stands in for what

| Collaborator                        | In a test                                                                                                                  | Why                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lance / lance-namespace             | real pylance on `tmp_path`: `tests/integration/conftest.py::real_ns_client`, `tests/unit/conftest.py::overlay_dataset`     | The claims are about what Lance writes. The `MagicMock(spec=LanceNamespace)` behind `::client` passes a table landed at the wrong file version, so it serves only claims about routing and error mapping. |
| S3 read through boto3 / `storage`   | moto `mock_aws()`                                                                                                          | In-process and fast.                                                                                                 |
| S3 read by pylance or pyarrow       | `moto.server.ThreadedMotoServer`: `tests/integration/test_moto_s3.py`                                                      | `mock_aws()` patches botocore. The native Lance and Arrow clients never see it.                                      |
| Outbound HTTPX                      | `respx` (e.g. `services/flows/tests/test_routes.py`)                                                                       | `writing-python` → `references/testing.md` § Mocking HTTPX with `respx`.                                             |
| NATS JetStream                      | a real broker: CI binds one; locally, see `references/rask-fixtures.md` § NATS                                            | The claims are about stream and consumer semantics.                                                                  |
| Ray job client                      | a structural fake `cast` to `JobSubmissionClient`: `packages/ray-kit/tests/test_dashboard_bounds.py`                       | No Ray runtime starts, and the production signature stays typed without a `# type: ignore`.                          |
| OpenFGA, authz not the claim        | `dependency_overrides` on the service's `current_subject` and `get_checker` (built by `service_kit.governed.deps.make_auth_deps`, exported from the service's security module) | The offline suite has no OpenFGA server.                                                                             |
| OpenFGA, authz is the claim         | the model's own `.fga.yaml` suite (`make fga-test`); a real Dex + OpenFGA as Dagger services (`dagger call governance-chain`, `dagger call auth-chain`, both in CI) | The decision comes from the model and the tuples the app wrote, and only a real server evaluates both. |
| The chart                           | `tests/unit/chart_render.py` (`render(*flags)`, cached per flag tuple)                                                     | One render per overlay per worker, instead of one per test.                                                          |
| rask's own types (Settings, models) | the real class, built with test values                                                                                     | `writing-python` → `references/testing.md` § Doubles.                                                                |

## Skips, docstrings, parallelism

- **Run with `-rs` and read the skip list.** A skip for a missing tool or broker is a lane defect
  (`writing-python` → `references/testing.md` § Determinism and speed). Existing ones not to copy:
  `pytest.skip("helm not available")` (`chart_render.render_text`, and every file
  `git grep -l 'helm not available'` lists), and the ingest suites' `skipif` when no NATS answers.
- **Docstrings follow CLAUDE.md's comment rule**: rationale and provenance, never history.
- **`make check-fast` uses `--dist loadfile`**, because three suites are parallel-unsafe at the file
  level (the `lance.audit` process-global logger, `configure_audit`'s level, the registry CAS
  markers). `make test` uses xdist's default `--dist load`, so a failure that appears only there
  points at a test that depends on sharing a worker with the rest of its file.

## References

- `references/rask-fixtures.md`: the red check, and for each fixture (service app, real pylance, a
  moto server for pylance, a live uvicorn, local NATS, the Ray fake, the chart) the file to copy
  from and the parts it relies on.
- `references/pruning.md`: deleting redundant tests. How to find tests that execute no production
  line and subset twins, and what to keep.
