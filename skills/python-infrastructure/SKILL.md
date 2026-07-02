---
name: python-infrastructure
description: Python system-reliability patterns for this project's services. Use when queueing tasks or building async workers (NATS JetStream / nats-py), designing durable multi-step workflows that must survive crashes (Dapr Workflow / dapr-ext-workflow), handling transient failures with retries/backoff (tenacity) or circuit breakers, caching with Redis, or instrumenting services with OpenTelemetry traces/metrics/logs (OTLP). NOT FOR language idioms or type hygiene (use `writing-python`), HTTP routing (use `fastapi`), or deep OTel reference (use `otel`).
---

# Python Infrastructure

System-reliability concerns for Python services in this project, grouped because real code uses them together: a task you queue (background-jobs) needs retries (resilience), instrumentation (observability), and often touches the cache (Redis) on the same call path.

## Preferred stack

| Concern                      | Tool                               | Notes                                                                                                                                                         |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message bus / task queue     | **NATS JetStream** (via `nats-py`) | Durable streams, consumer groups, replay. Replaces Celery/RabbitMQ here.                                                                                      |
| Durable multi-step workflows | **Dapr Workflow** (via `dapr-ext-workflow`) | Activity-level checkpointing via the Dapr sidecar (one per pod). When vs JetStream: `references/dapr-workflows.md` § When to use. |
| HTTP                         | **FastAPI**                        | See sibling `fastapi` skill.                                                                                                                                  |
| Cache                        | **Redis**                          | `redis.asyncio` for async workers.                                                                                                                            |
| Retries / backoff            | **tenacity**                       | Exponential + jitter, by default.                                                                                                                             |
| Observability                | **OpenTelemetry** (OTLP)           | Traces + metrics + logs. See sibling `otel`.                                                                                                                  |
| Logging                      | stdlib `logging` → OTel handler    | Don't pull in `structlog`; OTel forwards stdlib records.                                                                                                      |
| HTTP client                  | **httpx** (async)                  | Replaces `requests`.                                                                                                                                          |

## Scope routing

| If you need to…                                                                                                 | Read                              |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Handle an operation that can fail transiently (network/IO/3rd-party API) — what to retry, with what backoff, when to stop, circuit-breakers | `references/resilience.md`        |
| Run work out-of-request as a single idempotent action or fanout/event distribution — queue a task, design a worker, persist job state, retry/DLQ patterns (NATS JetStream + `nats-py`) | `references/background-jobs.md`   |
| Run a multi-step workflow where re-running step 1 on crash is bad — activity-level recovery, retry policies, scheduling (Dapr Workflow, sidecar required) | `references/dapr-workflows.md`    |
| Know what's happening in production — instrument a service with OTel traces/metrics/logs, four golden signals   | `references/observability.md`     |
| Avoid repeated expensive lookups — Redis as a cache (TTL, invalidation) or short-lived coordination (rate limits, dedup windows, single-flight locks) | `references/caching.md`           |

JetStream vs Dapr Workflow in depth: `references/dapr-workflows.md` § When to use. All five at once for one feature? Instrument first, then queue / workflow + retry + cache.

## Cross-skill boundaries

- **`writing-python`** — _how_ to write the function. This skill — _how it survives in production_.
- **`writing-python` → `references/error-handling.md`** — _what exception to raise_. This skill — _what to do when it's raised across a network boundary_.
- **`writing-python` → `references/resource-management.md`** — _how to clean up resources_ (context managers). This skill — _how to keep retrying when resources fail to acquire_.
- **`fastapi`** — request handlers and DI. This skill — what runs around them.
- **`otel`** — full OTel reference (Python SDK, signals, attributes, Collector). This skill's `observability.md` pins project conventions on top.

## Top gotchas

- **Retry without backoff is a DoS amplifier** — default to exponential backoff + jitter from day one (`references/resilience.md`).
- **Retrying non-idempotent operations duplicates side effects** — pair retry with an idempotency key OR mark the operation non-retryable (`references/background-jobs.md` § Make tasks idempotent).
- **Synchronous code inside an async worker blocks the event loop** — use `httpx.AsyncClient`, or run sync code in an executor.
- **Logs and metrics serve different audiences** — don't try to derive one from the other; instrument both.
- **Trace context is lost across queue boundaries** unless you `inject`/`extract` it via message headers (`references/observability.md` § Trace context across queue boundaries).
- **Redis cache stampede** — N clients miss a hot key simultaneously and all recompute; use single-flight locks (`references/caching.md` § Cache stampede protection).
