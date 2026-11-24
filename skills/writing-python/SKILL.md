---
name: writing-python
description: Idiomatic Python 3.13–3.15, Pydantic-first (not dataclasses), uv/ruff/ty toolchain, with each newer feature gated on the project's requires-python. Use when writing, reviewing or testing Python code, moving a project to a newer Python, or establishing a project's Python conventions. NOT for background jobs, retries, or observability (use `python-infrastructure`).
allowed-tools: Read, Bash, Grep, Glob
---

# Writing Python

Language-level Python for this project.

## Scope routing

| If you need to…                                                            | Read                                |
| -------------------------------------------------------------------------- | ----------------------------------- |
| Configure ruff/ty, naming, imports, docstrings (Google style)              | `references/code-style.md`          |
| Add type annotations, generics, protocols, narrowing                       | `references/type-safety.md`         |
| Decide between composition vs inheritance, layer code, inject dependencies | `references/design-patterns.md`     |
| Audit code against a checklist of known bad patterns                       | `references/anti-patterns.md`       |
| Validate inputs, design exception hierarchies, handle partial failures     | `references/error-handling.md`      |
| Manage connections/file handles/streams via context managers               | `references/resource-management.md` |
| Load env vars, set up `pydantic-settings`, validate config at boot         | `references/configuration.md`       |
| Look up everyday patterns (project layout, async, functools caching/dispatch, pathlib, logging) | `references/patterns.md`            |
| Build a CLI (`typer`, output formats, progress, exit codes)                | `references/cli.md`                 |
| Write, review or delete a test — what earns a place, tiers, fixtures, doubles, async, parametrize | `references/testing.md` |

## House style — non-negotiable

- **Pydantic, not dataclasses.** Every structured value object is a `BaseModel`. Settings are `pydantic-settings.BaseSettings`. A project enforces this with ruff `banned-api` on `dataclasses.dataclass` (`references/testing.md` § What a test is for), never with a test that greps source.
- **Type hints on every public signature.** `ty` runs in CI; untyped code fails.
- **`uv` for everything Python-level**: environments, dependencies, the interpreter.
- **`ruff` for lint + format, `ty` for type checking, both from the lock.** Run `uv run ruff …` and `uv run ty check`, so the
  version that judges the code is the one `uv.lock` pins and CI runs. `uvx ty` resolves the newest release instead
  (measured 2026-11-24: `uvx ty` ran 0.0.109 where the lock pinned 0.0.86), so a local pass can disagree with CI.
- **Stdlib first.** Only add a dep when stdlib genuinely doesn't fit (e.g. `httpx` for async HTTP, `typer`/`rich` for CLIs, `pydantic` for validation).
- **Fail fast.** Validate at boundaries; raise informative errors immediately.
- **Integration tests are the keepers.** Test I/O and glue through real collaborators; delete a unit test an integration test already covers; a test that reads source, an AST or prose is not a test. `references/testing.md` § What a test is for.
- **Self-documenting code, not noise comments.** Comment only the non-obvious _why_; the default is no comment. See `references/code-style.md`.

## Quick patterns

```python
# Type hints — all signatures, modern union syntax
def get_user(user_id: str) -> User | None: ...
async def fetch(url: str, timeout: float = 30.0) -> dict[str, object]: ...

# Pydantic model (instead of @dataclass)
from pydantic import BaseModel, Field

class Config(BaseModel):
    host: str
    port: int = Field(default=8080, ge=1, le=65535)
    tags: list[str] = Field(default_factory=list)

# Pattern matching for shape dispatch
match event:
    case {"type": "click", "x": x, "y": y}:
        handle_click(x, y)
    case {"type": "key", "code": code}:
        handle_key(code)
    case _:
        raise ValueError(f"Unknown event: {event}")
```

## Toolchain

```bash
uv sync                    # install deps from uv.lock
uv add <pkg>               # add a runtime dep
uv add --dev <pkg>         # add a dev dep

uv run ruff check --fix .  # lint + autofix, at the locked ruff
uv run ruff format .       # format
uv run ty check            # type-check, at the locked ty

uv run pytest -v           # tests (project-aware — pytest must import your package)
uv run pytest --cov        # coverage; sources come from [tool.coverage.run]
uv run fastapi dev         # FastAPI app, when applicable
```

**Rule of thumb**: inside a project, every tool runs through `uv run`, at the version the lock pins. `uvx <tool>` is for a
directory with no project, or for trying a newer release on purpose (`uvx ruff@0.17.6 check …`).

A pre-commit hook pins its own ruff (`rev:` in the hook config). Keep it equal to the lock's ruff: a hook two minors behind
cannot parse newer syntax (measured: ruff 0.15.13 fails on `{**d for d in ds}` with `--target-version py315`; 0.16.0 parses
it).

## Version-gated features: read `requires-python` first

A feature newer than the project's floor is a `SyntaxError` or `NameError` on the floor version, and ruff and ty report it
as one (measured, ruff 0.16.0 and ty 0.0.86 at `--python-version 3.13`: "Cannot use `lazy` import statement on Python 3.13
(syntax was added in Python 3.15)", "Name `frozendict` used when not defined"). Ruff takes its target from
`requires-python` when `target-version` is unset; ty takes it from `[tool.ty.environment] python-version` — keep the two
equal.

| Floor | Use | Instead of |
| --- | --- | --- |
| 3.14 | unquoted forward references, no `from __future__ import annotations` in new modules (PEP 649/749) | quotes, the `__future__` import |
| 3.14 | `uuid.uuid7()` for time-ordered ids; `uuid.UUID(int=n, version=8)` | hand-set version and variant bits |
| 3.14 | t-strings (`t"..."`, PEP 750) for any string a value is escaped into (SQL, filters, HTML, shell) | f-string + a quoting helper the caller can forget |
| 3.14 | `except A, B:` — let `ruff format` write it (it removes the parentheses at a py314+ target, measured) | hand-picking a form |
| 3.15 | `sentinel("NAME")` for a "not passed" default (PEP 661) | `object()` |
| 3.15 | `frozendict` for constant lookup tables (PEP 814) | a module-level `dict` that `Final` does not freeze |
| 3.15 | `[*xs for xs in rows]`, `{**d for d in ds}` (PEP 798) | `chain.from_iterable`, `reduce(operator.iadd, …)`, `sum(lists, [])` |
| 3.15 | `base64.b64decode(…, validate=True, canonical=True)` when a second spelling of the same bytes must be refused | decode, re-encode and compare |
| 3.15 | `bytearray.take_bytes()` to hand a built buffer out | `bytes(buf)` (a copy) |
| 3.15 | `lazy import` / `lazy from` only for CLI start-up time, never globally (see Top gotchas) | — |

Not house defaults on any version: the free-threaded build, the JIT, `concurrent.interpreters` (3.14 says many extension
modules are not yet compatible), `TypedDict(closed=True)` / `TypeForm` (data is a Pydantic model here).

Moving a project up a version is three changes in one commit: `requires-python` in every `pyproject.toml`,
`.python-version`, and the base images; then `uv lock`. Before it, check every binary dependency has a `cp3XX` or `abi3`
wheel for each target arch in the locked version, not only in the latest (measured 2026-11-24 for 3.15: pyarrow 25,
pydantic-core 2.46, numpy 2.4 had none; ray had none in any release).

## Cross-skill boundaries

- **`python-infrastructure`** — what to do when the function above needs to retry across a network boundary, run in a worker, or be observable in prod.
- **`fastapi`** — HTTP routing, dependency injection, async-vs-sync runtime semantics, FastAPI/Pydantic conventions.
- **`testing-python`** — the suite as a whole: markers and `strict_markers`, parallel runs, `--durations`, the red-check recipe, pruning. `references/testing.md` here is one test. A project's own wiring (directories, lanes, the fixtures it ships) lives in that project's skill.
- **`astral:uv`** / **`astral:ruff`** / **`astral:ty`** — deep tool reference for the toolchain.

## Top gotchas

- **Pydantic API surface to remember** — `model_dump` / `model_validate` / `model_dump_json` / `model_validate_json`, `Field(alias=..., default_factory=...)`, `model_config = {...}`, `@field_validator` / `@model_validator`. Don't paste snippets using `dict()`, `parse_obj()`, `Config` class, or `@validator` — those are from an older API and won't work.
- **Never turn on lazy imports globally.** `-X lazy_imports=all` / `PYTHON_LAZY_IMPORTS=all` breaks libraries that rely on
  a submodule import's side effect (measured on 3.15.2: pylance 14.0.3 fails with `module 'pyarrow' has no attribute
  'dataset'`). An explicit `lazy import` is per statement and only at module scope; a lazy import of anything Pydantic or
  FastAPI reads in an annotation is loaded at once anyway (measured).
- **`sentinel` and `frozendict` are builtins from 3.15.** A local named `sentinel` now shadows one (ruff A001/A002).
- **Interpreter limits are not constants.** From 3.14 the C recursion limit is stack-based: `json.loads` of nested lists
  fails at 9,998 levels on 3.13.15 and at 65,207 on 3.15.2 (aarch64, measured), and `str()` of the same value at 9,999 and
  47,425. Code that relies on a parser refusing deep input must bound the depth itself.
