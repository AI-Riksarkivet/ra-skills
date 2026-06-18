# rask test recipes

Copy-paste fixtures lifted from the real suite. Imports are exactly what the cited files use.
For generic technique (parametrize, respx, FIRST, boundary cases) see `writing-python` →
`references/testing.md`. This file is only the rask-shaped scaffolding.

## Async in-memory sqlite session

From `components/services/core/tests/test_pipelines_registry.py`. Note the **`@pytest_asyncio.fixture`**
(not `@pytest.fixture`) and the per-test `@pytest.mark.asyncio` — rask does **not** set
`asyncio_mode = "auto"`.

```python
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from core.models.batch import Batch
from core.models.enums import ManifestStatus


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite://")  # in-memory; no file
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)  # OK in tests; prod uses Alembic
    async with AsyncSession(engine) as s:
        s.add(Batch(batch_id="B1", manifest_status=ManifestStatus.OK, page_count=10,
                    chunk_id=1, chunk_total=1, last_synced_at="2026-01-01T00:00:00+00:00"))
        await s.commit()
        yield s
    await engine.dispose()


@pytest.mark.asyncio
async def test_uses_session(session: AsyncSession) -> None:
    ...
```

`SQLModel.metadata.create_all` is fine **inside a test** to stand up a throwaway schema. In app
startup it's banned — schema changes go through Alembic (`make pg-migrate`). See the project CLAUDE.md.

## Seeded-Batch TestClient app (sync sqlite + FastAPI)

From `test_chunk_submit_endpoint.py`. The `app` fixture pins every `.env`-sourced setting so the
suite is hermetic regardless of a developer's local `.env` (the `conftest.py` autouse fixture pins
`RASK_API_PREFIX` on top of this).

```python
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel

from core.models.batch import Batch
from core.models.enums import HtrStatus, ManifestStatus


@pytest.fixture
def seeded_db(tmp_path: Path) -> Path:
    db = tmp_path / "batches.db"
    engine = create_engine(f"sqlite:///{db}")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        s.add(Batch(batch_id="CACHED001", htr_status=HtrStatus.CACHED,
                    manifest_status=ManifestStatus.OK, page_count=30, cached_pages=30,
                    transcribed_pages=0, chunk_id=1, chunk_total=1,
                    last_synced_at="2026-01-01T00:00:00+00:00"))
        s.commit()
    engine.dispose()
    return db


@pytest.fixture
def app(seeded_db: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> FastAPI:
    monkeypatch.setenv("RASK_VIEWER_INPUT", str(tmp_path / "in"))
    monkeypatch.setenv("RASK_VIEWER_OUTPUT", str(tmp_path / "out"))
    monkeypatch.setenv("RASK_BATCHES_DB", str(seeded_db))
    monkeypatch.setenv("RAY_DASHBOARD_URL", "http://127.0.0.1:1")  # unreachable on purpose
    monkeypatch.delenv("HCP_ENDPOINT", raising=False)
    (tmp_path / "in").mkdir()
    (tmp_path / "out").mkdir()
    from core.main import create_app  # import inside the fixture, after env is pinned
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c
```

Two details that matter:
- **Import `create_app` *inside* the fixture**, after `monkeypatch.setenv`. Importing at module top
  would read settings before they're pinned.
- Point `RAY_DASHBOARD_URL` at `http://127.0.0.1:1` for validation-only tests: a 422 from the
  `SubmitRequest` field-validator fires *before* the endpoint touches Ray, so the test passes with
  Ray unreachable.

## Asserting the error envelope

rask's exception middleware returns a problem-details-ish JSON body. Assert its shape, not a bare status:

```python
resp = client.post("/api/v1/chunks/1/submit", json={"pipeline": "bogus"})
assert resp.status_code == 422
body = resp.json()
assert body["status"] == 422
assert body["title"] == "Validation Error"
assert any(e["field"].endswith("pipeline") for e in body["errors"])
```

## moto for S3

From `packages/storage/tests/test_storage.py`. `moto[s3]` is in the root dev group. Seed the bucket
with a boto client inside `mock_aws()`; exercise the `storage` wrappers against it.

```python
import boto3
from moto import mock_aws

from storage import S3Source


def test_s3_source_round_trip():
    with mock_aws():
        c = boto3.client("s3", region_name="us-east-1")
        c.create_bucket(Bucket="bucket-in")
        c.put_object(Bucket="bucket-in", Key="a.jpg", Body=b"x")
        src = S3Source(bucket="bucket-in")
        assert src.read("a.jpg") == b"x"
```

Production code imports `storage.s3_client`, never raw boto3 — but seeding a moto bucket directly
with `boto3.client(...)` is fine *inside the test*.

## Structural Ray fake (no Ray import)

From `test_pipelines_registry.py`. Implement only the methods the code under test calls, then `cast`
to the real protocol type so the typed signature stays honest. No Ray runtime in unit tests.

```python
from typing import cast

from ray.job_submission import JobSubmissionClient  # type only


class _FakeRayClient:
    def __init__(self) -> None:
        self.stopped: list[str] = []

    def submit_job(self, *, submission_id: str, **_: object) -> str:
        return submission_id

    def stop_job(self, submission_id: str) -> bool:
        self.stopped.append(submission_id)
        return True


client = cast(JobSubmissionClient, _FakeRayClient())
```

For the derive/orchestrator path the same file uses `_FakeJob` (a `JobDetails` stand-in with a
`.dict()`) and `_FakeDeriveClient` whose `get_job_info` returns `None` to skip per-stage telemetry.

## CLI cheat-sheet

| Goal | Command |
|---|---|
| Everything | `make test` (= `uv run pytest` over `testpaths`) |
| Single test | `uv run pytest packages/htr/tests/test_geometry.py::test_bbox_dimensions` |
| By name | `uv run pytest -k bbox` |
| Skip slow (model-loading) | `uv run pytest -m "not slow"` |
| Only slow | `uv run pytest -m slow` |
| One brick's suite | `uv run pytest components/services/core/tests` |

Always `uv run pytest`, never `uvx pytest` — pytest imports your package and must run inside the
workspace venv. A new brick's `tests/` runs only after its path is added to `testpaths` in the root
`pyproject.toml` (workspace enrollment in `pyproject.toml`/`package.json` does not enroll tests).
