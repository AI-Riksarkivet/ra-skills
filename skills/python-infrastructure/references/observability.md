# Observability

This project uses **OpenTelemetry** (OTLP) for the three signals — traces, metrics, logs — exported to an OTel Collector that fans out to backends. Don't pull in `structlog`, Prometheus client libs, or ad-hoc tracing — OTel's stdlib-`logging` handler, metrics API, and tracer cover all three.

## Where to look first

| If you need to…                                                                              | Read                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Set up the OTel SDK, configure exporters, instrument a service (manual + auto), troubleshoot | sibling skill **`otel`** → `references/python-sdk.md` |
| Design a Collector pipeline (receivers, processors, exporters)                               | sibling skill **`otel`** → `references/collector.md`  |
| Pick attribute names/values that match the spec (HTTP, DB, messaging, etc.)                  | sibling skill **`otel`** → `references/attributes.md` |
| Span naming/kind/status, metric instrument types, log structure                              | sibling skill **`otel`** → `references/signals.md`    |

This file documents the **project-specific conventions** layered on top of the `otel` skill. Read that for the deep reference.

## Required resource attributes

Every service sets these on `Resource.create({...})` at startup:

| Key                           | Value                                            | Source                   |
| ----------------------------- | ------------------------------------------------ | ------------------------ |
| `service.name`                | The service name, e.g. `rask-api`, `rask-worker` | env: `OTEL_SERVICE_NAME` |
| `service.version`             | App version                                      | env: `SERVICE_VERSION`   |
| `deployment.environment.name` | `local` / `staging` / `production`               | env: `ENVIRONMENT`       |

Set via env or in code:

```bash
export OTEL_SERVICE_NAME="rask-api"
export OTEL_RESOURCE_ATTRIBUTES="service.version=1.2.3,deployment.environment.name=production"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector:4317"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED="true"
```

Prefer the env-var route; only set things in code that can't be expressed in env. Leave the sampler at its default (`AlwaysOn`) — sampling happens in the Collector, not the SDK (`otel` → `references/collector.md`).

## Logging — stdlib `logging`, not structlog

Stdlib `logging` with `OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED=true` (or the `LoggingInstrumentor`) emits records as OTel log records carrying the current trace/span IDs automatically. Pass structured fields via `extra=`:

```python
import logging

log = logging.getLogger(__name__)

log.info("order_processed", extra={"order_id": order.id, "amount": order.total})
log.error("payment_failed", extra={"order_id": order.id, "provider": "stripe"}, exc_info=True)
```

Severity discipline (what belongs at each level): `otel` → `references/signals.md` § Severity.

## What to instrument

**Auto-instrument first** — `opentelemetry-bootstrap -a install`, then run with `opentelemetry-instrument` (covered libraries and setup: `otel` → `references/python-sdk.md`). Manually add spans only for business operations the auto-instrumentation can't see (`process_order`, not every helper); span naming, kinds, and the full API: `otel` → `references/signals.md`.

## The four golden signals

For every external boundary (HTTP, DB, queue, cache), make sure you can answer:

1. **Latency** — request duration. Already on auto-instrumented spans; for custom work, record a `Histogram`.
2. **Traffic** — request rate. Auto-instrumented as span counts; or a `Counter` for custom flows.
3. **Errors** — error rate. Spans with `StatusCode.ERROR`; or a labeled `Counter`.
4. **Saturation** — pool/queue depth, CPU, memory. `UpDownCounter` for pools, `ObservableGauge` for resource usage.

```python
from opentelemetry import metrics

meter = metrics.get_meter(__name__)

request_duration = meter.create_histogram(
    name="http.server.request.duration",
    unit="s",
    description="Request latency",
)
active_connections = meter.create_up_down_counter(
    name="db.client.connections.usage",
    description="Connections currently in use",
)
```

Use **semantic-convention names** wherever they exist. See `otel` → `references/attributes.md`.

## Bounded cardinality

Metric attributes must be bounded — per-user/per-request detail (user IDs, request IDs, raw paths with IDs) belongs on spans and logs, never on metric labels. Details and examples: `otel` → `references/signals.md` § Cardinality.

## Trace context across queue boundaries

Publishing to NATS JetStream (or any queue) loses the current trace unless you propagate it explicitly: `propagate.inject(...)` into the message headers on publish, `propagate.extract(...)` in the consumer before opening the processing span. Mechanism, code, and extras (baggage, span links): `otel` → `references/python-sdk.md` § Across non-HTTP boundaries.

## Cross-cutting decorator (timed + traced)

```python
from contextlib import contextmanager
import time
import logging
from opentelemetry import trace

log = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

@contextmanager
def timed_operation(name: str, **attrs):
    """Open a span, time the block, log the result."""
    start = time.perf_counter()
    with tracer.start_as_current_span(name) as span:
        for k, v in attrs.items():
            span.set_attribute(k, v)
        try:
            yield span
        except Exception as e:
            # No span.record_exception() — deprecated. Status + log record instead
            # (otel skill → references/signals.md § Exceptions).
            span.set_status(trace.Status(trace.StatusCode.ERROR, f"{type(e).__name__}: {e}"))
            elapsed_ms = (time.perf_counter() - start) * 1000
            log.error(
                "operation_failed",
                extra={"operation": name, "duration_ms": round(elapsed_ms, 2), **attrs},
                exc_info=True,
            )
            raise
        else:
            elapsed_ms = (time.perf_counter() - start) * 1000
            log.info(
                "operation_completed",
                extra={"operation": name, "duration_ms": round(elapsed_ms, 2), **attrs},
            )


with timed_operation("fetch_user_orders", user_id=user.id):
    orders = await order_repository.get_by_user(user.id)
```
