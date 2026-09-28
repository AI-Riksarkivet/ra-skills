# rask test fixtures and the red check

Each section names the live file to copy from, and the non-obvious parts that file relies on. Read the
file itself for the current code. This reference does not restate it.

## Contents

- The red check
- A service app, with its lifespan
- Real pylance on `tmp_path`
- A moto server that pylance can reach
- A live uvicorn socket
- NATS, locally
- The Ray job client
- The chart

## The red check

Run this once per new or changed test, with the fix and the test both in the working tree:

```bash
git stash push -- <path/to/fixed_module.py>          # set the fix aside; the test stays
find <member>/src -name __pycache__ -prune -exec rm -rf {} +
PYTHONDONTWRITEBYTECODE=1 uv run pytest <test_file>::<test_name> -p no:cacheprovider
#   expect: FAILED, on the assertion that names the bug
PYTHONDONTWRITEBYTECODE=1 uv run pytest <member>/tests tests/integration <dirs step 1 found> \
  -m "not slow and not e2e" -n 16 -q -rf -p no:cacheprovider
#   expect: your test is the ONLY failure. Another failure means that test catches the same bug;
#   keep the integration one and delete the other.
git stash pop
PYTHONDONTWRITEBYTECODE=1 uv run pytest <test_file>::<test_name>   # expect: passed
```

- **Purge `__pycache__` and set `PYTHONDONTWRITEBYTECODE=1`.** Python accepts a cached `.pyc` when
  the source's mtime and size match. A stash and pop within the same second, with the file at the same
  size, can leave the fixed code running while you believe it is reverted.
- **Fail for the right reason.** An `ImportError`, a fixture error or a timeout is not red. The
  failure must be the assertion the test exists for.
- For a fix that is already committed, reverse it in the working tree with
  `git show <sha> -- <path> | git apply -R`, and restore it with `git checkout -- <path>`.

## A service app, with its lifespan

**Settings through an `lru_cache`d `get_*settings()`** (catalog, lineage, maintenance, medallion,
annotator, search, viewer). Copy `tests/integration/conftest.py::real_ns_client`. The order is
load-bearing:

1. `monkeypatch.setenv` every variable the service's settings require. For the catalog that includes
   `LANCE_S3_ACCESS_KEY_ID`/`LANCE_S3_SECRET_ACCESS_KEY`, even on the `dir` backend, because settings
   validate them at construction.
2. `get_settings.cache_clear()`, or the previous test's values survive.
3. Import the app **inside** the fixture.
4. Set `app.dependency_overrides[...]` on the registered callables.
5. `with TestClient(app) as client:` so that the lifespan runs.
6. Teardown: `app.dependency_overrides.clear()` and `get_settings.cache_clear()`.

`cache_clear()` reaches only what is read per request. What the module reads at import stays as the
first importer left it: `catalog/main.py`'s `_settings` fixes the docs switch, the body cap and the
write-concurrency cap. A test of one of those needs `importlib.reload`.

The sibling fixture `::client` has the same order over a `MagicMock(spec=LanceNamespace)`. It serves
only claims about routing, identifier parsing and error mapping.

**Settings read once at import** (`make_service_app`'s `build_settings()` in compute, controlplane,
flows and notifications; `build_gateway_settings()` in the gateway):

- Set the env the whole directory needs around the first import, in its `conftest.py`, then hand it
  back. Copy `services/controlplane/tests/conftest.py`. Env left set leaks into every other testpath:
  pytest collects all of them before it runs any test.
- A test that needs another value sets it with `monkeypatch.setenv` and calls
  `importlib.reload(<package>)` (`services/gateway/tests/test_notifications_proxy_shapes.py`).
- Code in `service_kit` itself builds a synthetic app with `make_service_app(..., settings=...)`
  (`packages/service-kit/tests/test_settings_are_injectable.py`).

**Ingest** has `ingest.create_app()`. Call it per test (`services/ingest/tests/test_ingest_api.py`).

`packages/service-kit/tests/conftest.py` shows an autouse fixture that pins required env from the
ambient value, so a developer's own setting still wins.

## Real pylance on `tmp_path`

- **A catalog app over a real `dir` namespace**: `tests/integration/conftest.py::real_ns_client`
  (`LANCE_REST_IMPL=dir`, `LANCE_REST_ROOT=<tmp_path>`, and `get_namespace` overridden with
  `lance_namespace.connect("dir", {"root": ...})`). Every create goes through the real 2.2 +
  stable-row-ids write.
- **A dataset shaped the way Lance writes it**: `tests/unit/conftest.py::overlay_dataset`, a factory
  fixture that commits through Lance's public API. Build odd manifests the same way, through Lance
  and not by hand, so that the test agrees with what Lance writes.

## A moto server that pylance can reach

Copy from `tests/integration/test_moto_s3.py::moto_endpoint`. `moto.server.ThreadedMotoServer(port=0)`
serves S3 over HTTP, and the catalog is pointed at it with `LANCE_REST_ROOT=s3://<bucket>` and
`LANCE_S3_ENDPOINT=<url>`.

- `mock_aws()` is not enough here. It patches botocore, and Lance's and Arrow's native S3 clients never
  go through botocore.
- The fixture is `scope="module"`: one server and one bucket per module. Each test isolates itself by
  namespace name, not by bucket.
- Plain `storage`/boto3 code does not need the server. `with mock_aws():` plus a boto3 client that
  seeds the bucket is enough (`packages/storage/tests/test_storage.py`).

## A live uvicorn socket

Use one when the claim is about the wire. `tests/unit/test_search_spec_binding.py` records a
query-model binding that `TestClient` accepts and a live uvicorn on fastapi 0.140.13 rejects with 422
on every call. The rask example is `tests/unit/test_bronze_is_governed_end_to_end.py`. The generic
fixture (port 0, a thread, a bounded wait for `server.started`) is in `fastapi` →
`references/testing.md` § A real server.

## NATS, locally

CI binds a real NATS to the pytest container (`.dagger/test.go`). The ingest queue suites read
`RASK_NATS_URL` and **skip** when nothing answers there, so a local run with no broker reports skips,
not failures. Bring one up as a Dagger service (never docker) at the version the chart deploys. `up`
holds the foreground, so run it in the background or in a second shell:

```bash
dagger core container from --address=nats:2.14.2-alpine with-exposed-port --port=4222 \
  with-default-args --args=nats-server,--jetstream as-service up --ports=14222:4222
```

```bash
RASK_NATS_URL=nats://127.0.0.1:14222 uv run pytest services/ingest/tests/test_worker_queue.py -rs
```

Verified 2026-09-28: 6 passed, with no skips.

## The Ray job client

Copy from `packages/ray-kit/tests/test_dashboard_bounds.py`: a small class that implements only the
methods the code under test calls (there, `list_jobs`), returned through
`cast(JobSubmissionClient, fake)`. No Ray runtime starts, and the function under test keeps its real
parameter type without a `# type: ignore`. The cast is not checked against Ray: give each fake method
the real method's signature.

## The chart

`from tests.unit.chart_render import DEFAULT_ARGS, render`. `render(*flags)` returns the parsed
manifests and is cached per verbatim flag tuple. `render_text(*flags)` returns Helm's raw stdout (use
it for size budgets, because parsing drops comments). The result is a tuple because it is shared:
never mutate it. Render through this module rather than calling your own `subprocess` helm.

`render_text` calls `pytest.skip("helm not available")` when helm is absent. That is the missing-tool
skip SKILL.md rules out, so don't copy it into new code. It finds helm on `PATH` (`make k3s-install`
installs it) or at `.localbin/helm`. The CI lane installs its own.
