# Everyday Patterns

Reference for project layout, async, pathlib, functools caching/dispatch, and logging.

Topics with their own reference are not repeated here: Pydantic model basics → `SKILL.md` § Quick patterns; type hints → `type-safety.md`; custom exceptions and validation → `error-handling.md`; context managers → `resource-management.md`.

## Contents

- Project structure
- Async patterns
- Pathlib
- Functools toolkit
- Logging

## Project structure

```
src/
└── mypackage/
    ├── __init__.py
    ├── __main__.py      # CLI entry
    ├── domain/          # Business logic
    ├── services/        # Operations
    └── adapters/        # External integrations
tests/
pyproject.toml
```

## Async patterns

```python
import asyncio
import httpx

async def fetch_all(urls: list[str]) -> list[bytes]:
    async with httpx.AsyncClient() as client:
        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks)
        return [r.content for r in responses]

async def fetch_with_timeout(url: str, timeout: float = 30.0) -> bytes:
    async with asyncio.timeout(timeout):
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            return response.content
```

For structured concurrency, use `asyncio.TaskGroup`:

```python
async def fetch_both(a_url: str, b_url: str) -> tuple[bytes, bytes]:
    async with asyncio.TaskGroup() as tg:
        a_task = tg.create_task(fetch(a_url))
        b_task = tg.create_task(fetch(b_url))
    return a_task.result(), b_task.result()
```

## Pathlib

```python
from pathlib import Path
import json

def process_files(directory: Path) -> list[Path]:
    return list(directory.glob("**/*.json"))

def read_config(path: Path) -> dict:
    return json.loads(path.read_text())
```

Prefer `Path` over `os.path` everywhere.

## Functools toolkit

Stdlib helpers worth reaching for. Each has a narrow sweet spot — pick by *why* you're caching/dispatching, not because it looks clever.

### `@cache` — unbounded memoization

Use for pure functions with a small, bounded input space (config lookups, parsed schemas, regex compilation results).

```python
from functools import cache

@cache
def compiled_pattern(name: str) -> re.Pattern[str]:
    return re.compile(PATTERNS[name])
```

Don't use if: inputs are unbounded (memory leak), the function has side effects, or results expire (price, auth tokens).

### `@lru_cache(maxsize=N)` — bounded memoization

Same as `@cache` but with an eviction cap. Reach for it when the input space is large but you only care about hot keys.

```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def geocode(address: str) -> tuple[float, float]:
    return geocoding_client.lookup(address)
```

⚠ **Never on instance methods** — the cache holds `self`, leaking the instance. Apply to module-level functions, or use `methodtools.lru_cache`.

### `@cached_property` — lazy, per-instance derived value

For expensive properties on long-lived objects. Computed on first read, stored on the instance, cleared when the instance is garbage-collected. Works cleanly on Pydantic models.

```python
from functools import cached_property
from pydantic import BaseModel

class Report(BaseModel):
    rows: list[Row]

    @cached_property
    def total(self) -> Decimal:
        return sum((r.amount for r in self.rows), start=Decimal("0"))
```

Don't use if: the underlying data mutates after the property is read (the cache won't invalidate). On frozen Pydantic models this is ideal.

### `@singledispatch` — type-driven polymorphism without ABCs

Replaces `if isinstance(x, A): ... elif isinstance(x, B): ...` chains. The dispatcher picks an implementation based on the first argument's runtime type.

```python
from functools import singledispatch

@singledispatch
def render(node: object) -> str:
    raise TypeError(f"no renderer for {type(node).__name__}")

@render.register
def _(node: Heading) -> str:
    return f"# {node.text}\n"

@render.register
def _(node: Paragraph) -> str:
    return f"{node.text}\n\n"
```

For methods, use `@singledispatchmethod`. Prefer this over the Visitor pattern (see `design-patterns.md` § Pattern translation table).

Don't use if: dispatch depends on more than one argument (write a small dict of handlers instead), or the types form a tight closed set best modelled with a discriminated `match` statement.

### `partial` — pre-bind arguments

Specialize a callable without writing a wrapper. Useful as a callback, dependency-injection seam, or in `functools.reduce`.

```python
from functools import partial

retry_thrice = partial(retry, attempts=3, backoff=0.5)
result = retry_thrice(fetch, url)
```

For methods, `partialmethod`. Don't reach for `partial` when a closure or a `lambda` reads more clearly — `partial(f, x=1)` is denser than `lambda y: f(x=1, y=y)` only when there are many bound args.

### `reduce` — last resort

Almost always `sum()`, `min()`, `max()`, `itertools.accumulate`, or a plain loop reads better. Use `reduce` only for genuinely associative operations with no stdlib shortcut (e.g. merging a list of `set`s, composing functions).

```python
from functools import reduce
import operator

merged: set[str] = reduce(operator.or_, sets, set())
```

### When NOT to cache

- **Time-sensitive results** — stock prices, auth tokens, anything with a TTL. Use a real TTL cache (`cachetools.TTLCache`).
- **Side-effecting functions** — `@cache` will silently skip the side effect on a hit.
- **Mutable arguments** — `@cache` requires hashable args; passing a `list` raises, passing a custom unhashable class raises, but a class with a buggy `__hash__` silently caches wrong.
- **Hot loops where the cache lookup costs more than the work** — measure before optimizing.

## Logging

This project routes logging via OpenTelemetry. Configure the stdlib `logging` once; OTel auto-instrumentation forwards records to the OTLP exporter.

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

log = logging.getLogger(__name__)
log.info("processing_started", extra={"count": len(items)})
```

For tracing, metrics, and full OTel setup, see the `python-infrastructure` skill (`references/observability.md`) and the `otel` skill.
