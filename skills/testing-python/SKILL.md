---
name: testing-python
description: rask's test policy and pytest wiring — which test to write (integration keepers, unit tests only for pure branches, the red check, one test per closes-when clause), what stands in for Lance/S3/NATS/Ray/OpenFGA, and which lane runs what. Use before writing, changing or deleting a test in rask, when pruning tests, or when a test does not collect or runs in no lane.
---

# Testing in rask

Generic pytest craft (what a test is for, fixtures, doubles, async decorators, parametrize) is in
`writing-python` → `references/testing.md`. A FastAPI door's client and lifespan are in `fastapi` →
`references/testing.md`. This skill is rask's policy and wiring on top of those.

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
   - **e2e** (`tests/e2e-py`, marker `e2e`) only for claims that need the deployed stack.
3. **Make it red.** Revert the fix (for new behaviour, break the line the test is about), run the
   test, and watch it fail on the assertion that names the bug. Then restore. Do this once, at write
   time. The recipe is in
   `references/rask-fixtures.md` § The red check. Don't ship a control test that proves the first
   test can fail.
   Done when: the test is red with the fix reverted and green with it, and no other test went red on
   the revert. If another test did go red, one of the two is redundant; keep the integration one.
4. **Count.** Add at most one test per closes-when clause of the change, and state the net test delta
   (`tests: +N −M`) in the commit message.

## What is never a test

- **Source text, an AST, prose, or file names.** A rule about code shape (a banned import or
  decorator, a layer boundary) is a ruff `banned-api` rule or an import-linter contract in
  `pyproject.toml`, or it is nowhere.
  Why: a source-reading test stays green on a commented-out call, goes red on a harmless rename, and
  executes no production line.
  Rendering the chart with `helm template` and asserting on the manifest runs the product. That is a
  test.
- **An absence.** A test that asserts a deleted file, name or sentence is gone checks nothing that
  runs. Delete the code, and let the linter or the import error guard it.

## Wiring the config does not state

Read `[tool.pytest.ini_options]` in the root `pyproject.toml` for the current values. These are the
consequences it does not spell out.

- **`testpaths` is an explicit list.** A new `tests/` directory runs only after you add it there.
  Enrolling a workspace member does not enrol its tests.
- **`--import-mode=importlib`: test directories are not packages.** Share a fixture through the
  directory's `conftest.py`, or a helper through a plain module such as `tests/unit/chart_render.py`.
  Never `from test_x import ...`.
  Why: it resolves only when an earlier import happened to put the directory on `sys.path`, so it
  passes for the directory and fails for the single file.
- **Markers.** `slow` means real models or a long runtime. `e2e` means a live stack, and each
  per-suite e2e selector also carries `e2e`. When you add or use a marker, run with
  `--strict-markers`.
  Why: without it a misspelled marker is only a warning, and the test runs inside `-m "not slow"`.
- **Lanes.** `make test` runs `-m "not slow and not e2e"` at `-n 16`, then the `runners/htr` and
  `runners/dummy` suites. `PYTEST_WORKERS=0` gives one process and a readable traceback. CI
  (`dagger call test`, `.dagger/test.go`) runs the same marker filter serially, with
  `--timeout=300` and a real NATS bound, and runs **no** runner suite. A test under any other
  `runners/<name>/` runs in no lane until someone wires it.
- **Async is strict.** No `asyncio_mode` is set, so use the explicit form in `writing-python` →
  `references/testing.md` § Async. The `anyio` plugin is also loaded, but new tests use
  pytest-asyncio.
- **A service app is built at import** (`app = make_service_app(...)`), and its settings come from a
  cached `get_settings()`. In the fixture: pin env with `monkeypatch.setenv`, call
  `get_settings.cache_clear()`, import the app inside the fixture, set `dependency_overrides`, and
  enter `with TestClient(app)` to run the lifespan. Teardown clears the overrides and the cache. Copy
  `tests/integration/conftest.py::client`.
  Resolve the API prefix from `build_settings().api_prefix`. Never pin `RASK_API_PREFIX`.
- **Bound every wait.** A real OTLP exporter against a dead endpoint waits 10 s per attempt at
  process exit. `packages/service-kit/tests/conftest.py` caps `OTEL_EXPORTER_OTLP_TIMEOUT` (measured:
  10.19 s → 3.08 s). Give every client, broker connect and poll in a test a timeout. A suite that
  sleeps never goes red.

## What stands in for what

| Collaborator                       | In a test                                                                                                     | Why                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Lance / lance-namespace            | real pylance on `tmp_path`: `tests/integration/conftest.py::real_ns_client`, `tests/unit/conftest.py::overlay_dataset` | The claims are about what Lance writes. A `MagicMock` namespace passes a table landed at the wrong file version. |
| S3 read through boto3 / `storage`  | moto `mock_aws()`                                                                                             | In-process and fast.                                                                                  |
| S3 read by pylance or pyarrow      | `moto.server.ThreadedMotoServer`: `tests/integration/test_moto_s3.py`                                         | `mock_aws()` patches botocore. The native Lance and Arrow clients never see it.                       |
| Outbound HTTPX                     | `respx` (e.g. `services/flows/tests/conftest.py`)                                                             | It intercepts at the transport, so the real request pipeline runs.                                    |
| NATS JetStream                     | a real broker: CI binds one; locally, see `references/rask-fixtures.md` § NATS                               | The claims are about stream and consumer semantics.                                                   |
| Ray job client                     | a structural fake `cast` to `JobSubmissionClient`: `packages/ray-kit/tests/test_dashboard_bounds.py`          | No Ray import. Use `cast`, never `# type: ignore` (`ty` does not honour it).                          |
| OpenFGA                            | `dependency_overrides` on the authorize dependency when authz is not the claim; the model's own `.fga.yaml` suite (`make fga-test`); a live check is e2e (`-m auth`) | The offline suite has no OpenFGA server.                                                              |
| The chart                          | `tests/unit/chart_render.py` (`render(*flags)`, cached per flag tuple)                                        | One render per overlay per worker, instead of one per test.                                           |
| rask's own types (Settings, models) | the real class, built with test values                                                                       | A `SimpleNamespace` stand-in carries no signature, so it cannot see the change it exists to catch.    |

## Skips, names, runtime

- **A missing tool fails the test; the lane provides the tool.** The chart gates skipped on
  `helm not available` in CI until the Dagger lane installed helm. Run with `-rs` and read the skip
  list: a skip for a missing tool or broker is a lane defect.
- **Names state the behaviour**, `test_<unit>_<condition>_<outcome>`, in lower case. No CAPS for
  emphasis and no history (`no_longer`, `is_gone`, `stays_deleted`). Docstrings follow CLAUDE.md's
  comment rule: rationale and provenance, never history.
- **Runtime.** Run `uv run pytest <path> --durations=20` before and after a change that adds a
  fixture or I/O. Don't `time.sleep` to wait: poll with a deadline, or wait on an `Event`. Expensive
  shared setup goes in a `scope="module"`/`"session"` fixture, and xdist builds one per worker.
  `make check-fast` uses `--dist loadfile` because some suites are safe only with each file on one
  worker.

## References

- `references/rask-fixtures.md`: the red check, and for each fixture (service app, real pylance, a
  moto server for pylance, a live uvicorn, local NATS, the Ray fake, the chart) the file to copy
  from and the parts it relies on.
- `references/pruning.md`: deleting redundant tests. How to find tests that execute no production
  line and subset twins, and what to keep.
