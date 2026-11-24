# Parameter Models

[upstream: `references/parameter-models.md`; fastapi 0.157–0.161 for combining, optional groups and form unions]

Group related query, header, cookie or form inputs in one Pydantic model: `Annotated[Model, Query()]` (or `Header()`, `Cookie()`, `Form()`). Several models can sit beside individual parameters and dependencies. Do not add a dependency just to unpack fields into a model.

Each model validates on its own. The wire stays flat: no key is named after the function parameter.

## Contents

- Several and optional models
- `extra` and shared names
- Forms and unions

## Several and optional models

```python
from datetime import date
from typing import Annotated

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field

app = FastAPI()


class Pagination(BaseModel):
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class DateRange(BaseModel):
    start: date
    end: date


@app.get("/items/")
def read_items(
    pagination: Annotated[Pagination, Query()],
    date_range: Annotated[DateRange | None, Query()] = None,
    search: str | None = None,
) -> ItemPage: ...
```

- `Model | None` **with** `= None` makes the group optional; `| None` alone still makes it required.
- With the default `extra="ignore"`, omitting both `start` and `end` leaves `date_range` as `None`; sending either one validates the group and requires both.

## `extra` and shared names

- A model's `extra` applies to EVERY field submitted in that location, siblings included (fastapi ≥ 0.160): `extra="forbid"` refuses a sibling parameter's field, `extra="allow"` takes it as an extra (and an ordinary header such as `Host` counts for a header model). Leave `extra="ignore"` when groups share a location.
- A name or alias two models declare is validated by both: keep their types compatible, or give them distinct names.

## Forms and unions

- Forms need `python-multipart`. Unions of form models (`Annotated[Person | Company | None, Form(discriminator="kind")] = None`) need a distinct `Literal` per model. An empty submitted value counts as supplied; use `False` defaults for HTML checkboxes.

This replaces the "one factory dependency per parameter group" pattern in [`pagination.md`](pagination.md) where the group needs no logic.
