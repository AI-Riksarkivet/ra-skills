# Core Conventions

Day-to-day FastAPI conventions for this project — the rules that apply to almost every route and Pydantic model. Read this first when writing new code or reviewing a diff. Topic-specific patterns (auth, db, caching, etc.) live in their own references.

## Contents

- The `fastapi` CLI (dev + prod)
- Use `Annotated` for params and dependencies
- Do not use Ellipsis (`...`) for path operations or Pydantic models
- Return type or `response_model`
- Performance: no `ORJSONResponse` / `UJSONResponse`
- Including routers — `prefix` / `tags` on the router, not `include_router()`
- Request body limits — `max_body_size`, `form_limits`
- Parameter models → [`parameter-models.md`](parameter-models.md)
- Async vs sync path operations
- Constrained query values via `StrEnum`
- Do not use Pydantic `RootModel`
- One HTTP operation per function
- Removed and deprecated in recent FastAPI

## The `fastapi` CLI

Run the development server on localhost with reload:

```bash
fastapi dev
```

Run the production server:

```bash
fastapi run
```

### Add an entrypoint in `pyproject.toml`

The FastAPI CLI reads the entrypoint from `pyproject.toml`:

```toml
[tool.fastapi]
entrypoint = "my_app.main:app"
```

### Or pass a path explicitly

When the entrypoint can't go in `pyproject.toml` (independent small app, etc.):

```bash
fastapi dev my_app/main.py
```

Prefer the `pyproject.toml` entrypoint when possible.

## Use `Annotated` for params and dependencies

Always prefer the `Annotated` style for parameter and dependency declarations. It keeps function signatures working in other contexts, respects the types, and allows reusability.

### In parameter declarations

```python
from typing import Annotated

from fastapi import FastAPI, Path, Query

app = FastAPI()


@app.get("/items/{item_id}")
async def read_item(
    item_id: Annotated[int, Path(ge=1, description="The item ID")],
    q: Annotated[str | None, Query(max_length=50)] = None,
):
    return {"message": "Hello World"}
```

Not the default-value form:

```python
# DO NOT DO THIS
@app.get("/items/{item_id}")
async def read_item(
    item_id: int = Path(ge=1, description="The item ID"),
    q: str | None = Query(default=None, max_length=50),
):
    return {"message": "Hello World"}
```

### For dependencies

Use `Annotated` with `Depends()`, and create a type alias for re-use:

```python
from typing import Annotated

from fastapi import Depends, FastAPI

app = FastAPI()


def get_current_user():
    return {"username": "johndoe"}


CurrentUserDep = Annotated[dict, Depends(get_current_user)]


@app.get("/items/")
async def read_item(current_user: CurrentUserDep):
    return {"message": "Hello World"}
```

Not the default-value form:

```python
# DO NOT DO THIS
@app.get("/items/")
async def read_item(current_user: dict = Depends(get_current_user)):
    return {"message": "Hello World"}
```

## Do not use Ellipsis (`...`) for path operations or Pydantic models

`...` as a default value for required parameters isn't needed and isn't recommended.

Do this:

```python
from typing import Annotated

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float = Field(gt=0)


app = FastAPI()


@app.post("/items/")
async def create_item(item: Item, project_id: Annotated[int, Query()]): ...
```

Not this:

```python
# DO NOT DO THIS
class Item(BaseModel):
    name: str = ...
    description: str | None = None
    price: float = Field(..., gt=0)


@app.post("/items/")
async def create_item(item: Item, project_id: Annotated[int, Query(...)]): ...
```

## Return type or `response_model`

When possible, include a return type. It validates, filters, documents, and serializes the response.

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None


@app.get("/items/me")
async def get_item() -> Item:
    return Item(name="Plumbus", description="All-purpose home device")
```

**Important**: return types or response models are what filter data to prevent sensitive-field exposure, and Pydantic uses them to serialize on the Rust side — that's the main performance lever.

The return type doesn't have to be a Pydantic model — a `list[int]`, `dict[str, object]`, etc. all work.

### When to use `response_model` instead

If the return type differs from what should be sent over the wire (filtering, sensitive fields), use `response_model=` on the decorator:

```python
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None


@app.get("/items/me", response_model=Item)
async def get_item() -> Any:
    return {"name": "Foo", "description": "A very nice Item"}
```

Annotate `-> Any` (upstream's form) or the real internal type; never `-> Item` with `response_model=Item` — FAST001 refuses it, and the model is built twice. A route that returns a `Response` subclass skips validation entirely, so `response_model=` there is documentation only (fine for a probe that picks its own status).

Particularly useful for filtering data to expose only public fields:

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class InternalItem(BaseModel):
    name: str
    description: str | None = None
    secret_key: str


class Item(BaseModel):
    name: str
    description: str | None = None


@app.get("/items/me", response_model=Item)
async def get_item() -> InternalItem:
    return InternalItem(
        name="Foo", description="A very nice Item", secret_key="supersecret"
    )
```

## Performance: no `ORJSONResponse` / `UJSONResponse`

Both are deprecated (fastapi 0.131.0). Declare a return type or `response_model` instead — Pydantic v2 serializes in Rust, which is the only optimization that matters.

## Including routers — `prefix` / `tags` on the router, not `include_router()`

Add router-level parameters (`prefix`, `tags`, shared `dependencies`) to the router itself:

```python
from fastapi import APIRouter, FastAPI

app = FastAPI()

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/")
async def list_items():
    return []


# In main.py
app.include_router(router)
```

Not on `include_router`:

```python
# DO NOT DO THIS
router = APIRouter()

@router.get("/")
async def list_items():
    return []

app.include_router(router, prefix="/items", tags=["items"])
```

Apply shared dependencies at the router level via `dependencies=[Depends(...)]`.

## Request body limits

[upstream: `SKILL.md` § Request Body Limits; fastapi 0.164.0 / 0.165.0, starlette ≥ 1.6.0]

Set a total-body cap in bytes on the app, raise or lower it on a router (or in `include_router()`) or one route. The limit counts bytes as they are read — a chunked body with no `Content-Length` is caught too — and answers 413 if the response has not started.

```python
from typing import Annotated

from fastapi import APIRouter, Body, FastAPI

app = FastAPI(max_body_size=1024 * 1024)                       # every route: 1 MiB
uploads = APIRouter(prefix="/uploads", max_body_size=100 * 1024 * 1024)


@uploads.post("/small", max_body_size=10 * 1024 * 1024)
async def small_upload(data: Annotated[bytes, Body(media_type="application/octet-stream")]) -> Receipt: ...
```

- `None` inherits; `0` allows only an empty body; unset everywhere means **unlimited**. Always set the app default.
- Middleware that reads the body before routing is held to the APP limit, whatever the route allows.
- `form_limits={"max_fields": …, "max_files": …, "max_part_size": …}` bounds form parsing (defaults 1,000 / 1,000 / 1 MiB per text field); exceeding one is 400. Each key inherits on its own.
- The total cap is separate from per-file checks and the spool threshold: `max_body_size` bounds the request, `form_limits` the parser.

Why per route: a JSON body is buffered and then parsed with `json.loads` ON THE EVENT LOOP (measured 117 ms for a 65 MiB body, on top of the buffer). A cap sized for the one upload route lets every JSON route take that body. Before fastapi 0.164 the same rule is a pure-ASGI middleware that counts `http.request` bytes and matches routes by path.

## Async vs sync path operations

Use `async def` only when the body is genuinely async-compatible (every blocking call is `await`ed or non-blocking). Otherwise use plain `def` — FastAPI runs sync functions in a threadpool so they don't block the event loop. "In case of doubt, or by default, use regular `def`" [upstream: `SKILL.md`].

```python
# async def when calling async code
@app.get("/async-items/")
async def read_async_items():
    data = await some_async_library.fetch_items()
    return data


# plain def when calling blocking/sync code (or when in doubt)
@app.get("/items/")
def read_items():
    data = some_blocking_library.fetch_items()
    return data
```

Same rule applies to dependencies. **Never run blocking code inside an `async def`** — it works but kills throughput. That includes a helper that reads a file: a sync `load_model()` doing `json.loads(path.read_text())` per call, called per item in an `async` route, measured 177 ms on the loop for 1,000 items. Cache what never changes (`@functools.cache`) or move it to the thread.

A project may instead write `async def` routes and hand every blocking call to `run_in_threadpool`/`asyncify` explicitly — the rule is met as long as no blocking call is left on the loop. ruff's `ASYNC` rules guard the direct calls; nothing guards a helper, so review for it. For mixing blocking and async, see [`production-patterns.md`](production-patterns.md) § Bridging sync ↔ async.

## Constrained query values via `StrEnum`

For fixed-set query values (sort order, status, format) use `StrEnum` — auto-documents as a dropdown in `/docs` and beats `Query(pattern="^(asc|desc)$")`:

```python
from enum import StrEnum


class SortOrder(StrEnum):
    asc = "asc"
    desc = "desc"


@app.get("/items/")
async def list_items(sort: SortOrder = SortOrder.asc):
    ...
```

For full list-endpoint patterns (offset / cursor / keyset, `PaginationParams` dep, generic `Page[Item]`), see [`pagination.md`](pagination.md).

## Do not use Pydantic `RootModel`

Use regular type annotations with `Annotated` + Pydantic validation utilities instead. FastAPI creates a `TypeAdapter` automatically — no custom subclass needed.

Do this:

```python
from typing import Annotated

from fastapi import Body, FastAPI
from pydantic import Field

app = FastAPI()


@app.post("/items/")
async def create_items(items: Annotated[list[int], Field(min_length=1), Body()]):
    return items
```

Not this:

```python
# DO NOT DO THIS
from pydantic import Field, RootModel


class ItemList(RootModel[Annotated[list[int], Field(min_length=1)]]):
    pass


@app.post("/items/")
async def create_items(items: ItemList):
    return items
```

## One HTTP operation per function

Each route function handles exactly one HTTP method. Don't multiplex with `@app.api_route(methods=[...])`.

Do this:

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str


@app.get("/items/")
async def list_items():
    return []


@app.post("/items/")
async def create_item(item: Item):
    return item
```

Not this:

```python
# DO NOT DO THIS
from fastapi import FastAPI, Request


@app.api_route("/items/", methods=["GET", "POST"])
async def handle_items(request: Request):
    if request.method == "GET":
        return []
    ...
```

Multiplexed handlers produce confusing OpenAPI output, mix request bodies into a single signature, and turn the body into an `if request.method` ladder.

## Removed and deprecated in recent FastAPI

| Gone / deprecated | Since | Use |
| --- | --- | --- |
| Unknown keywords on `Path`/`Query`/`Header`/`Cookie`/`Body`/`Form`/`File` (`Query(custom="x")`) | 0.155.0 — now `TypeError` | `Query(json_schema_extra={"custom": "x"})` |
| `FastAPI(openapi_prefix=...)`, `FastAPI(**extra)` | 0.145.0 — removed | `root_path` at the server |
| `FastAPI(root_path=...)` | 0.146.0 — deprecated | `uvicorn --root-path` / `fastapi run --root-path` |
| `regex=` | 0.100.0 — deprecated | `pattern=` |
| `@app.on_event(...)` | 0.93.0 — superseded by lifespan, deprecated | lifespan ([`production-patterns.md`](production-patterns.md)) |
| `ORJSONResponse` / `UJSONResponse` | 0.131.0 — deprecated | a return type or `response_model` |

Behaviour that changed under existing code (fastapi 0.148–0.162): defaults of omitted `Query`/`Header`/`Cookie`/`Form` values are no longer validated unless `validate_default=True` (0.148); an explicit JSON `null` is validated as `None` — a non-nullable field rejects it even when it has a default, which now applies only to an omitted value (0.151); a parameter model's `extra` now applies to sibling fields in the same location (0.160); an omitted `bool` form field uses its declared default or is a missing-field error, no longer `False` (0.162).
