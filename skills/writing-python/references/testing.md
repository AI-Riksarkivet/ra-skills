# Testing

How to write one test, in any project. The suite as a whole (markers and `strict_markers`,
parallel runs, `--durations`, the red-check recipe, pruning) is `testing-python`. A FastAPI app's
client and lifespan: `fastapi` → `references/testing.md`. A project's own wiring (which directories,
which lanes, the fixtures it already ships) lives in that project's skill.

## Contents

- What a test is for
- Tiers
- The shape of one test
- Parametrize
- Fixtures
- Doubles
- Mocking HTTPX with `respx`
- Async
- Determinism
- Boundaries
- `skip` and `xfail`

## What a test is for

Read this section before writing or deleting a test. Everything below it is technique.

1. **Pin behaviour at a public interface.** Call what a caller calls (a function's return value, an
   HTTP response, a row in the store) and assert what the caller sees.
   Why: a test coupled to internals goes red on every refactor and stays green on real bugs. You pay
   for it twice and it protects nothing.

   ```python
   # before: pins the implementation
   def test_get_user(user_service, mock_repo):
       mock_repo.get.return_value = User(id="123", name="Test")
       user_service.get_user("123")
       mock_repo.get.assert_called_once_with("123")


   # after: pins the behaviour, against a real in-memory repository
   def test_get_user_returns_the_stored_user(repo: InMemoryUserRepository) -> None:
       repo.save(User(id="123", name="Test"))
       assert UserService(repo=repo).get_user("123") == User(id="123", name="Test")
   ```

2. **Red.** A test earns its place when it goes red on a plausible bug and no other test already goes
   red on that bug. Check this once, while writing. Either write the test before the fix and watch it
   fail, or revert the fix, run the test, see it fail on the assertion that names the bug, and restore
   (the recipe, with its stale-bytecode trap: `testing-python` § The red check).
   Why: a test that has never been red may be unable to fail (a wrong fixture, an assert on a mock you
   configured yourself, a loop over nothing). A second test that fails on the same bug adds runtime
   and maintenance, not protection. Don't ship a separate "control" test to prove the first one can
   fail. The red check at write time is that proof.
   Done when: red with the bug, green without it, and deleting the test would leave that bug uncaught.

3. **Code shape belongs in a linter.** A rule about how code is written (a banned import or
   decorator, a layer that must not import another) is a ruff rule or an import-linter contract, or
   it is nowhere. It is not a test that reads source text, parses an AST, greps prose or docs, or
   checks file names.
   Why: the linter checks every file on every run, reports the line, and ignores comments and strings.
   A source-reading test stays green on a commented-out call, goes red on a harmless rename, and
   executes no production code.

   ```toml
   # pyproject.toml: flags `from dataclasses import dataclass` and `@dataclasses.dataclass` (TID251)
   [tool.ruff.lint]
   extend-select = ["TID251"]

   [tool.ruff.lint.flake8-tidy-imports.banned-api]
   "dataclasses.dataclass".msg = "Structured values are pydantic BaseModel."
   ```

4. **Coverage is a map, not a target.** Read the missing lines on the paths that matter
   (`--cov-report=term-missing`). Don't add tests to raise a percentage.
   Why: a percentage rewards executing lines, not checking them. The cheapest way to raise it is a
   test that asserts nothing.
   Prune as you go. A test whose executed lines are a subset of another test's, with no assertion
   the other lacks, is redundant. Delete it in the same change that adds its superset. Pruning a
   whole suite: `testing-python` → `references/pruning.md`.

5. **What fails rules 1 to 3 is not a test.** Delete it on sight; write the behavioural test instead.
   - A **change-detector** pins how the code is written now (an internal call sequence, a private
     structure, a snapshot of a representation no caller reads). It goes red on every refactor and
     on no bug.
   - A **tautology** asserts what it arranged itself: patch `f` to return 5, assert `f` returns 5.
     It cannot go red.
   - A **mock-call-only** test's sole assertion is `assert_called_*` on a collaborator you own. Assert
     the result the caller sees (§ Doubles for when the call is the contract).
   - A **reader** of source, an AST, prose, docs or file names, including a check that a deleted
     file, name or sentence is still absent. Rule 3: a linter, or nowhere.

6. **Change the test that already drives the code before adding one.** Search the suite for the
   function or route under change, and extend or replace the test you find. Add a new test only when
   none drives that code.
   Why: a second test beside the first is the redundancy of rule 2, written on purpose.
   Done when: you can name the test you changed or replaced, or you have searched and none exists.

## Tiers

| Tier        | Drives                                                                             | Use for                                                              |
| ----------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Unit        | one pure function or class; no I/O; milliseconds                                   | a pure function's distinct branches and boundaries                   |
| Integration | real collaborators: the app over HTTP, a real throwaway store, a local server      | anything touching I/O, config, serialization or wiring: the keepers |
| End-to-end  | the deployed system                                                                | the few paths that need the real deployment                          |

I/O and glue code (routes, adapters, config, anything that talks to a store or a service) is tested
through real collaborators, never through a unit test of its parts. When a unit test covers what an
integration test covers, delete the unit test.
Why: the integration test also catches the wiring, serialization and configuration bugs the unit test
cannot see, so the unit test is the cheaper duplicate.

## The shape of one test

- **Arrange, Act, Assert, with exactly one Act.** Why: one Act means a failure names one behaviour. A
  test with no Act (it only inspects objects, files or source) tests nothing that runs.
- **One behaviour per test.** Several asserts on the result of one Act are fine.

  ```python
  # before: tests of attribute storage, which is Pydantic's behaviour, not yours
  def test_user_stores_name():
      assert User(name="A", email="a@x.io").name == "A"

  def test_user_stores_email():
      assert User(name="A", email="a@x.io").email == "a@x.io"


  # after: the behaviours the class owns
  def test_activate_marks_a_new_user_active() -> None:
      user = User(name="A", email="a@x.io")
      user.activate()
      assert user.is_active


  def test_activate_refuses_a_suspended_user() -> None:
      user = User(name="A", email="a@x.io", suspended=True)
      with pytest.raises(UserSuspendedError, match="suspended"):
          user.activate()
  ```

- **Assert the exact value**: `assert result == {"id": 42, "name": "Ada"}`, not `"Ada" in str(result)`
  or `len(result) > 0`. Use `pytest.raises(E, match=...)` for exceptions.
  Why: a loose assert passes on wrong output. An exact one prints the diff when it fails.
- **The name states condition and outcome**: `test_<unit>_<condition>_<outcome>`, lower case.
  Why: the failure report is the name. History (`no_longer`, `still`) and emphasis (CAPS) say nothing
  about behaviour.

## Parametrize

- **One case per distinct branch or boundary.** Two cases that take the same path through the code
  are one case. The exception is the two sides of a boundary (`n == limit`, `n == limit + 1`): they
  can take the same path and each catches a different off-by-one.
  Why: each extra case costs runtime and reads as coverage it does not add.
- **Parametrize over inputs to the unit, never over the repository's files.**
  Why: a case per source file grows with the tree and tests the tree, not the unit.
- Give cases ids with `pytest.param(..., id=...)`. Stacked `@pytest.mark.parametrize` decorators
  multiply into a cartesian product. Stack them only when every combination is a distinct branch.

```python
@pytest.mark.parametrize(
    ("email", "error"),
    [
        pytest.param("", "email required", id="empty"),
        pytest.param("user@", "invalid format", id="no-domain"),
    ],
)
def test_validate_email_rejects(email: str, error: str) -> None:
    with pytest.raises(ValidationError, match=error):
        validate_email(email)
```

## Fixtures

- **Shared fixtures live in `conftest.py`**, and shared helpers in a plain (non-`test_`) module.
  Never import from another `test_*.py` module.
  Why: a test module is not a library. Importing one runs its module-level code and ties the import
  to collection order. Under `--import-mode=importlib` it resolves only when an earlier import happened
  to put its directory on `sys.path`, so it passes for the directory and fails for the single file.
- **Scope by cost.** The default is `function` scope. Expensive read-only setup (a local server, a
  rendered artefact, a large generated file) goes in `scope="module"` or `"session"`. Anything a test
  mutates is reset by a function-scoped fixture layered on top.
  Why: a mutable session fixture makes tests depend on order. Under pytest-xdist every worker builds its
  own session fixtures, so a resource that must exist once per run needs a file lock.
- **Factory fixtures** when a test needs several instances: return a builder, record what it built,
  release it at teardown.

  ```python
  @pytest.fixture
  def make_bucket(s3: S3Client) -> Iterator[Callable[[str], str]]:
      made: list[str] = []

      def _make(name: str) -> str:
          s3.create_bucket(Bucket=name)
          made.append(name)
          return name

      yield _make
      for name in made:
          empty_and_delete(s3, name)
  ```

- **`tmp_path` for files, `monkeypatch` for environment variables and attributes.** Both undo
  themselves at teardown.
  Why: a fixed path (`/tmp/x`) or a raw `os.environ[...] = ...` leaks into the next test and the next run.
- **Autouse sparingly.** An autouse fixture runs for every test beneath its `conftest.py`. Keep it to
  what every one of those tests needs.
- **Order-independent.** Each test passes alone (`pytest path::test_name`) and under `-n`.
  A test that passes only after another test ran is a bug in the test.

## Doubles

- **Replace only what you do not own and cannot run locally**: a third-party API, a paid service,
  the clock. Run your own code and cheap local infrastructure for real (an in-memory or `tmp_path`
  store, a local server).
  Why: a mock encodes your assumption about the collaborator. When the assumption is wrong, the mock
  agrees with the bug.
- **Prefer a fake to a mock.** A fake is a small working implementation (an in-memory repository) and
  behaves consistently across every test that uses it. A `Mock` answers whatever each test told it.
- **A double carries the whole signature.** `create_autospec(Real, instance=True)` raises on a call
  the real signature would reject. A structural fake passed through `typing.cast` keeps the code under
  test typed, but nothing checks the fake against the real class, so give each of its methods the real
  method's signature. Build your own classes (settings, models) for real with test values. Never stand
  them in with a `SimpleNamespace` or a `type(...)` object.
  Why: a narrow stand-in cannot see the signature change it exists to catch. The test stays green while
  production breaks.
- **Patch where the name is used, not where it is defined.**

  ```python
  # app/orders.py does `from app.email import send_email`
  monkeypatch.setattr("app.orders.send_email", fake_send)  # patches the name orders.py calls
  monkeypatch.setattr("app.email.send_email", fake_send)   # no effect on orders.py
  ```

  Why: `from x import y` binds a new name in the importing module. Patching the original leaves
  that binding untouched.
- **Assert an interaction only when the interaction is the contract**, such as an email sent or a
  request made to a third party. Otherwise assert the result.
  Why: `assert_called_once_with` on an internal collaborator pins the implementation.

## Mocking HTTPX with `respx`

`respx` intercepts at the HTTPX transport, so the code under test runs the real request pipeline (URL
building, headers, auth, retries) up to the send. Patching `httpx.AsyncClient.get` skips all of it.

```python
import httpx
import pytest
import respx


@pytest.mark.asyncio
@pytest.mark.respx(base_url="https://api.example.com")
async def test_get_user_returns_the_decoded_body(respx_mock: respx.MockRouter) -> None:
    respx_mock.get("/users/42").mock(return_value=httpx.Response(200, json={"id": 42, "name": "Ada"}))

    async with httpx.AsyncClient(base_url="https://api.example.com") as client:
        r = await client.get("/users/42")

    assert r.json() == {"id": 42, "name": "Ada"}
```

By default every routed call must fire (`assert_all_called=True`) and every unrouted call raises
(`assert_all_mocked=True`). Pass `assert_all_mocked=False` to `@pytest.mark.respx(...)` only for a
test that mocks a subset on purpose.

Side effects: a callable (inspect the request, build the response), an exception class
(`side_effect=httpx.ConnectError` for a transport failure), or an iterable (one response per call,
for retry tests):

```python
respx_mock.get("/eventually-ok").mock(side_effect=[httpx.Response(503), httpx.Response(200, json={"ok": True})])
```

When the request is the contract, assert it through the route:

```python
route = respx_mock.post("/orders").mock(return_value=httpx.Response(201))
...  # exercise the code
sent = route.calls.last.request
assert sent.headers["Authorization"] == "Bearer test-token"
assert sent.read() == b'{"item_id": 42}'
```

For code that takes its own `httpx.Client`, inject `httpx.MockTransport(router.handler)` from a
`respx.Router()` and call `router.assert_all_called()` yourself.

Rules:

- **Match exact URLs**: `respx_mock.get("/users/42")`, not a loose regex. A route that matches too
  widely hides a wrongly built URL.
- **One route per outbound call site.** Three endpoints, three routes.
- A FastAPI route that calls out keeps its real HTTPX client and gets `respx`. See `fastapi` →
  `references/testing.md`.

## Async

pytest-asyncio's default is **strict mode**. A project may set `asyncio_mode = "auto"` in its pytest
config, so check it. The explicit form below works in both modes:

```python
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def client() -> AsyncIterator[Client]:
    client = await Client.connect()
    yield client
    await client.close()


@pytest.mark.asyncio
async def test_fetch_user_returns_the_user(client: Client) -> None:
    assert await client.fetch_user(42) == User(id=42)
```

What each missing decorator does in strict mode (measured: pytest 9.1.1, pytest-asyncio 1.4.0):

| Written as                                          | Result                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@pytest.fixture` on an `async def` fixture         | setup ERROR: "requested an async fixture … with no plugin or hook that handled it"       |
| `async def test_…` with no `@pytest.mark.asyncio`   | FAILED: "async def functions are not natively supported"                                 |

A FastAPI app under test also needs its lifespan run. See `fastapi` → `references/testing.md`.

## Determinism

- **No sleeping to wait for something.** Poll the condition against a deadline, wait on an
  `asyncio.Event`/`threading.Event`, or inject the clock.
  Why: a fixed sleep is too short on a loaded machine (flaky) and too long everywhere else (slow).
- **Bound every wait**: client timeouts, broker connects, poll deadlines, and exporters flushed at
  exit. A real OTLP exporter pointed at an endpoint nothing serves waits out its timeout (the SDK
  default is 10 s) when the process exits, so a suite that builds real exporters sets
  `OTEL_EXPORTER_OTLP_TIMEOUT` low (measured on one suite: 10.2 s, and 3.1 s with the cap).
  Why: an unbounded wait does not fail, it hangs, and a hung suite reports nothing.
- **Pin every seed.** No real network in a unit test.
- **A test that needs a tool fails when the tool is missing**, and the CI lane provides the tool.
  Why: `skipif(tool missing)` is green everywhere the tool is absent, including the lane that should
  run it.
- **Size an input against the code's own bound, never against the interpreter's.** A recursion depth, an int-string
  digit limit or a stack size moves between Python versions (`json.loads` refuses 9,998 nested lists on 3.13.15 and
  parses 65,207 on 3.15.2, measured), and a test sized against one stops reaching its branch on the next version without
  failing. `anti-patterns.md` § Version-move anti-patterns.
  Why: such a test goes green for the wrong reason, which is worse than red.

Speed (`--durations`, xdist, per-test timeouts) is a property of the suite: `testing-python`
§ Speed and hangs.

## Boundaries

Bugs cluster at boundaries. For a function over a sequence or range, check: empty, a single element,
exactly the limit, one over, zero or negative where positive is expected, and `None` where a value is
expected. Each is a case only if it takes its own branch.

When a bug is found, add the nearby cases that take a **different branch**, not every similar input:

```python
# The bug was leap-year February. Each case below is a distinct branch of the rule.
@pytest.mark.parametrize(
    ("year", "month", "last"),
    [
        pytest.param(2024, 1, 31, id="31-day-month"),
        pytest.param(2024, 4, 30, id="30-day-month"),
        pytest.param(2024, 2, 29, id="leap"),
        pytest.param(2023, 2, 28, id="common"),
        pytest.param(1900, 2, 28, id="century-common"),
        pytest.param(2000, 2, 29, id="400-year-leap"),
    ],
)
def test_last_day_of_month(year: int, month: int, last: int) -> None:
    assert last_day_of_month(year, month) == last
```

December is not added: it walks the same 31-day branch as January.

## `skip` and `xfail`

A skip is a question ("is this still valid?"). Fix the test or delete it. A test that needs a live
environment gets a marker the default lane deselects (`-m "not e2e"`), not a skip.

For a known failure, use `xfail(strict=True)` and name what fixes it. `strict=True` turns an
unexpected pass into a failure, which is how you learn the bug is fixed:

```python
@pytest.mark.xfail(strict=True, reason="parser drops a trailing tab; fixed by the tokenizer rewrite")
def test_parse_keeps_a_trailing_tab() -> None:
    assert parse("a\t") == ["a", ""]
```
