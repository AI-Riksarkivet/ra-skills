# Streaming

API-level streaming responses — JSON Lines, Server-Sent Events, raw byte streams. For file downloads / uploads with filenames + MIME types + range requests, see [`file-handling.md`](file-handling.md).

## Contents

- Stream JSON Lines
- Server-Sent Events (SSE)
- Stream bytes
- Arrow IPC (columnar payloads)
- Receiving Arrow in a request
- When to return `StreamingResponse` directly

## Stream JSON Lines

To stream JSON Lines, declare the return type and use `yield` to return the data.

```python
@app.get("/items/stream")
async def stream_items() -> AsyncIterable[Item]:
    for item in items:
        yield item
```

## Server-Sent Events (SSE)

To stream Server-Sent Events, use `response_class=EventSourceResponse` and `yield` items from the endpoint.

Plain objects are automatically JSON-serialized as `data:` fields, declare the return type so the serialization is done by Pydantic:

```python
from collections.abc import AsyncIterable

from fastapi import FastAPI
from fastapi.sse import EventSourceResponse
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    price: float


@app.get("/items/stream", response_class=EventSourceResponse)
async def stream_items() -> AsyncIterable[Item]:
    yield Item(name="Plumbus", price=32.99)
    yield Item(name="Portal Gun", price=999.99)
```

For full control over SSE fields (`event`, `id`, `retry`, `comment`), yield `ServerSentEvent` instances:

```python
from collections.abc import AsyncIterable

from fastapi import FastAPI
from fastapi.sse import EventSourceResponse, ServerSentEvent

app = FastAPI()


@app.get("/events", response_class=EventSourceResponse)
async def stream_events() -> AsyncIterable[ServerSentEvent]:
    yield ServerSentEvent(data={"status": "started"}, event="status", id="1")
    yield ServerSentEvent(data={"progress": 50}, event="progress", id="2")
```

Use `raw_data` instead of `data` to send pre-formatted strings without JSON encoding:

```python
yield ServerSentEvent(raw_data="plain text line", event="log")
```

## Stream bytes

For **dynamic byte responses inside an API endpoint** (rendered images, generated thumbnails, programmatic blobs). For file-on-disk downloads with `Content-Disposition`, range requests, and uploads, use [`file-handling.md`](file-handling.md) — don't reimplement those patterns here.

Declare a `response_class=` of `StreamingResponse` or a sub-class, and use `yield` to return the data.

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from app.utils import read_image

app = FastAPI()


class PNGStreamingResponse(StreamingResponse):
    media_type = "image/png"

@app.get("/image", response_class=PNGStreamingResponse)
def stream_image_no_async_no_annotation():
    with read_image() as image_file:
        yield from image_file
```

prefer this over returning a `StreamingResponse` directly — **unless the producer can fail or the
response needs a dynamic status/headers**, in which case see
[When to return `StreamingResponse` directly](#when-to-return-streamingresponse-directly):

```python
# DO NOT DO THIS (see the exception above)

import anyio
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from app.utils import read_image

app = FastAPI()


class PNGStreamingResponse(StreamingResponse):
    media_type = "image/png"


@app.get("/")
async def main():
    return PNGStreamingResponse(read_image())
```

## Arrow IPC (columnar payloads)

Every FastAPI+Arrow example online reaches for the same shape — `BytesIO` + `RecordBatchFileWriter` +
`Response`:

```python
# Fine for a small answer. NOT fine when the size is a property of the data.
sink = BytesIO()
with pa.ipc.RecordBatchFileWriter(sink, table.schema) as writer:
    writer.write_table(table)
return Response(content=sink.getvalue(), media_type="application/vnd.apache.arrow.file")
```

That holds **three copies at once**: the scan's table, the IPC encoding beside it, and the `bytes`
the response takes. Measured on rask's change feed (200k rows x 256B, 58.4 MB of Arrow): peak RSS
**147.6 MB, 2.53x the payload**. Streaming it dropped that to **60.1 MB, 1.03x**, with the wire
output byte-identical.

`pa.BufferOutputStream` does not help — it accumulates until `getvalue()`. But Arrow's writers accept
a **writeable Python object** (IPC guide; `pa.output_stream` takes `source : str, Path, buffer,
file-like object`), so a sink that hands each message out and forgets it is first-class API:

```python
class _ChunkSink(io.RawIOBase):
    """Holds only what the writer emitted since the last drain."""

    def __init__(self) -> None:
        self._parts: list[bytes] = []

    def writable(self) -> bool:
        return True

    def write(self, b) -> int:
        self._parts.append(bytes(b))
        return len(self._parts[-1])

    def drain(self) -> bytes:
        out = b"".join(self._parts)
        self._parts.clear()
        return out


def arrow_file_chunks(schema, batches) -> Iterator[bytes]:
    sink = _ChunkSink()
    with pa.ipc.new_file(sink, schema) as writer:
        for batch in batches:
            writer.write_batch(batch)
            if chunk := sink.drain():
                yield chunk
    if chunk := sink.drain():   # the FOOTER — it is written on close, so it is the last chunk
        yield chunk
```

**FILE vs STREAM framing is a contract, not a tuning knob.** A client calling `open_file` on stream
framing (or the reverse) fails at the first batch. FILE framing streams fine — the footer is written
when the writer closes, which is why the close must happen *inside* the generator.

## Receiving Arrow in a request

**FastAPI has no native Arrow support, and the failure is at import time, not request time.** Both of
these are circulating in blog posts; both were run and both raise:

```python
# FastAPIError: Invalid args for response field! ... is a valid Pydantic field type
@app.post("/process_batch/")
async def process_batch(batch: pa.RecordBatch): ...

# PydanticSchemaGenerationError: Unable to generate pydantic-core schema for
#   <class 'pyarrow.lib.TimestampType'>
class MyDataModel(BaseModel):
    timestamp: pa.TimestampType
```

The first fails when the route is REGISTERED — the app will not start. So "validate the Arrow schema
with a Pydantic model" is not an available design: Pydantic does not model Arrow types. Validate with
Arrow's own `schema.equals(expected)` after reading.

Read the body yourself and let Arrow parse it:

```python
@app.post("/ingest")
async def ingest(request: Request) -> IngestResult:
    body = await request.body()
    try:
        table = pa.ipc.open_stream(pa.py_buffer(body)).read_all()
    except pa.ArrowInvalid as exc:
        raise HTTPException(status_code=400, detail=f"not Arrow IPC stream framing: {exc}") from exc
    if not table.schema.equals(EXPECTED_SCHEMA):
        raise HTTPException(status_code=422, detail=f"schema mismatch: {table.schema}")
    ...
```

Two things that bite:

- **`await request.body()` buffers the whole upload.** That is the request-side twin of the response
  defect above. Cap it — a `Content-Length` check, a reverse-proxy limit, or middleware — because an
  unbounded columnar upload is sized by the client.
- **A framing mismatch does not say so.** Sending FILE framing to `open_stream` (or the reverse)
  raises `Expected to read 1330795073 metadata bytes` — that number is the `ARROW1` magic read as a
  length. Agree on framing as a contract and say which one in the media type
  (`application/vnd.apache.arrow.file` vs `.stream`); do not expect the error to diagnose it.

**Do not route Arrow through Pandas or JSON** (`batch.to_pandas().to_json()`). It discards the
columnar layout, the zero-copy buffers and the type fidelity that are the only reasons to use Arrow —
a JSON round-trip cannot even preserve an Arrow timestamp's unit. If the client needs JSON, it did not
need Arrow.

## When to return `StreamingResponse` directly

The `response_class=` + `yield` form above is right when the producer cannot fail. It is **wrong when
the producer validates**, and the failure is silent.

With `yield from producer()` the endpoint IS the generator, so the producer runs after the response
has already begun. Measured: a producer that raises gives the caller **200 with an empty body**.
Returning the response calls the producer in the endpoint body, where the same raise is a 500 an
exception handler can turn into a 400.

```python
@app.post("/changes")
def changes(...) -> Response:
    data = read_changes(...)   # raises HERE, while a 4xx is still possible
    return StreamingResponse(data, media_type=ARROW_FILE)
```

This matters for lazy scanners. `Dataset.scanner(...)` constructs happily and raises only on the
first pull, so the producer should pull one batch eagerly, inside its error guard, and stream the
rest — otherwise a bad column or predicate becomes a short, unopenable 200.

Returning it directly is also required when the response needs a dynamic `status_code` or headers
(206 + `Content-Range` for a ranged read, say), which `response_class=` cannot express.
