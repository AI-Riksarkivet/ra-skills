---
name: writing-python
description: Idiomatic Python 3.13+, Pydantic-first (not dataclasses), uv/ruff/ty toolchain. Use when writing, reviewing or testing Python code, or establishing a project's Python conventions. NOT for background jobs, retries, or observability (use `python-infrastructure`).
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
- **`ruff` for lint + format.**
- **`ty` for type checking.** CI runs `uvx ty check`.
- **Stdlib first.** Only add a dep when stdlib genuinely doesn't fit (e.g. `httpx` for async HTTP, `typer`/`rich` for CLIs, `pydantic` for validation).
- **Fail fast.** Validate at boundaries; raise informative errors immediately.
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

uvx ruff check --fix .     # lint + autofix (isolated env, no install needed)
uvx ruff format .          # format
uvx ty check               # type-check

uv run pytest -v           # tests (project-aware — pytest must import your package)
uv run pytest --cov        # coverage; sources come from [tool.coverage.run]
uv run fastapi dev         # FastAPI app, when applicable
```

**Rule of thumb**: `uvx <tool>` for tools that only need the file (`ruff`, `ty`); `uv run <tool>` for tools that need your project's environment (`pytest`, `fastapi`, anything that imports your code).

## Version-gated features: check `requires-python` first

On 3.13 each 3.14 row is a SyntaxError or an ImportError, so a project on `>=3.13` cannot use them.

- **3.14: template strings** — `t"Hello {name}"` returns a `Template` object (use for SQL/HTML where literal interpolation is unsafe).
- **3.14: `except` without parens** — `except ValueError, TypeError:` (PEP 758).
- **3.14: `concurrent.interpreters`** — true parallelism via subinterpreters.
- **3.14: `compression.zstd`** — Zstandard in stdlib.
- **3.13+: free-threaded build (PEP 703)** — no GIL, opt-in; experimental in 3.13, supported from 3.14.

## Cross-skill boundaries

- **`python-infrastructure`** — what to do when the function above needs to retry across a network boundary, run in a worker, or be observable in prod.
- **`fastapi`** — HTTP routing, dependency injection, async-vs-sync runtime semantics, FastAPI/Pydantic conventions.
- **A project's testing skill** (rask: `testing-python`) — its test policy and pytest wiring (testpaths, markers, lanes, the fixtures it ships). `references/testing.md` here is the technique.
- **`astral:uv`** / **`astral:ruff`** / **`astral:ty`** — deep tool reference for the toolchain.

## Top gotchas

- **Pydantic API surface to remember** — `model_dump` / `model_validate` / `model_dump_json` / `model_validate_json`, `Field(alias=..., default_factory=...)`, `model_config = {...}`, `@field_validator` / `@model_validator`. Don't paste snippets using `dict()`, `parse_obj()`, `Config` class, or `@validator` — those are from an older API and won't work.
