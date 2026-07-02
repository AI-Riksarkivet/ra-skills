# Resilience Patterns

Retries, exponential backoff with jitter, timeouts, fault-tolerant decorators. `tenacity` is the default.

## Basic retry

```python
from tenacity import (
    retry,
    stop_after_attempt,
    stop_after_delay,
    wait_exponential_jitter,
    retry_if_exception_type,
)
import httpx

TRANSIENT_ERRORS = (ConnectionError, TimeoutError, OSError)

@retry(
    retry=retry_if_exception_type(TRANSIENT_ERRORS),
    stop=stop_after_attempt(5) | stop_after_delay(60),
    wait=wait_exponential_jitter(initial=1, max=30),
)
def fetch_data(url: str) -> dict:
    """Fetch data with automatic retry on transient failures."""
    response = httpx.get(url, timeout=30)
    response.raise_for_status()
    return response.json()
```

## Retry only appropriate errors

Never retry:

- `ValueError`, `TypeError` — bugs, not transient
- Authentication errors — invalid credentials won't become valid
- HTTP 4xx except 429 — client errors are permanent

```python
RETRYABLE_EXCEPTIONS = (
    ConnectionError,
    TimeoutError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
)

@retry(
    retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=1, max=10),
)
def resilient_api_call(endpoint: str) -> dict:
    return httpx.get(endpoint, timeout=10).json()
```

## HTTP status code retries

```python
from tenacity import retry_if_result

RETRY_STATUS_CODES = {429, 502, 503, 504}

def should_retry_response(response: httpx.Response) -> bool:
    return response.status_code in RETRY_STATUS_CODES

@retry(
    retry=retry_if_result(should_retry_response),
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=1, max=10),
)
def http_request(method: str, url: str, **kwargs) -> httpx.Response:
    return httpx.request(method, url, timeout=30, **kwargs)
```

## Combined exception and status retry

```python
from tenacity import (
    retry,
    retry_if_exception_type,
    retry_if_result,
    stop_after_attempt,
    wait_exponential_jitter,
    before_sleep_log,
)
import logging
import httpx

log = logging.getLogger(__name__)

TRANSIENT_EXCEPTIONS = (
    ConnectionError, TimeoutError, httpx.ConnectError, httpx.ReadTimeout,
)

@retry(
    retry=(
        retry_if_exception_type(TRANSIENT_EXCEPTIONS)
        # RETRY_STATUS_CODES / should_retry_response: single definition in
        # § HTTP status code retries above.
        | retry_if_result(should_retry_response)
    ),
    stop=stop_after_attempt(5),
    wait=wait_exponential_jitter(initial=1, max=30),
    before_sleep=before_sleep_log(log, logging.WARNING),
)
def robust_http_call(method: str, url: str, **kwargs) -> httpx.Response:
    return httpx.request(method, url, timeout=30, **kwargs)
```

## Logging retry attempts

```python
import logging
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)

def log_retry_attempt(retry_state) -> None:
    exception = retry_state.outcome.exception()
    log.warning(
        "operation_retry",
        extra={
            "attempt": retry_state.attempt_number,
            "exception_type": type(exception).__name__,
            "exception_message": str(exception),
            "next_wait_seconds": (
                retry_state.next_action.sleep if retry_state.next_action else None
            ),
        },
    )

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, max=10),
    before_sleep=log_retry_attempt,
)
def call_with_logging(request: dict) -> dict:
    ...
```

Also emit a retry-count metric per operation (a labeled `Counter` — see `observability.md` § The four golden signals): a rising retry rate is the earliest signal of a failing dependency.

## Timeout decorator

Every network call gets an explicit timeout — pass `timeout=` on the client call, or wrap the whole operation:

```python
import asyncio
from functools import wraps
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")

def with_timeout(seconds: float):
    """Decorator to add timeout to async functions."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            return await asyncio.wait_for(func(*args, **kwargs), timeout=seconds)
        return wrapper
    return decorator

@with_timeout(30)
async def fetch_with_timeout(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.json()
```

## Stack cross-cutting concerns

Don't define a second span wrapper here — `observability.md` § Cross-cutting decorator owns `timed_operation`. Stack tracing outermost, then timeout, then retry, business logic at the bottom:

```python
@with_timeout(30)
@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter())
async def fetch_user_data(user_id: str) -> dict:
    ...

# Trace at the call site with the shared helper (observability.md § Cross-cutting decorator):
with timed_operation("fetch_user_data", user_id=user_id):
    data = await fetch_user_data(user_id)
```

## Fail-safe defaults

Degrade gracefully when non-critical operations fail.

```python
from functools import wraps
from collections.abc import Callable
from typing import TypeVar
import logging

log = logging.getLogger(__name__)
T = TypeVar("T")

def fail_safe(default: T, log_failure: bool = True):
    """Return default on failure instead of raising."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if log_failure:
                    log.warning(
                        "fail_safe_default",
                        extra={"function": func.__name__, "error": str(e)},
                    )
                return default
        return wrapper
    return decorator

@fail_safe(default=[])
async def get_recommendations(user_id: str) -> list[str]:
    """Return empty list on failure — recommendations are non-critical."""
    ...
```

## Circuit breakers

For dependencies that fail in bursts, a circuit breaker (e.g. `purgatory`, `pybreaker`) stops the bleeding by failing fast once a failure threshold is crossed, then probing for recovery. Pair with `fail_safe` for graceful degradation downstream.
