# Caching (Redis)

This project uses **Redis** as the cache for hot reads and as a coordination point for short-lived state (rate limits, dedup windows, single-flight). Use `redis.asyncio` for any async service.

## Client

Use `redis.asyncio`. Client construction (pool options, timeouts) and FastAPI wiring are owned by `fastapi/references/redis.md` § One shared client — reuse its `make_redis` in workers too.

## Cache-aside and invalidation

The get-or-fetch helper and the invalidation code are owned by `fastapi/references/cache.md` (§ `cache_aside` helper, § Mutation → invalidation — the helper works outside FastAPI too). Project rules that apply everywhere:

- **Always set a TTL.** Never let cache entries live forever; stale data is worse than a re-fetch.
- **Consistent key shape** — `{namespace}:{entity}:{id}` — so invalidation is predictable.
- **Invalidate after a successful write** (`DEL` the key after the commit, never before), one write path → one invalidation path.

## Cache stampede protection (single-flight)

When a hot key expires, N concurrent requests all miss and all recompute. Mitigate with a short-lived lock:

```python
import asyncio
import uuid

from redis.asyncio import Redis

async def get_with_singleflight(
    key: str,
    redis: Redis,
    compute: callable,
    ttl: int = 300,
    lock_ttl: int = 10,
) -> str:
    cached = await redis.get(key)
    if cached is not None:
        return cached

    lock_key = f"lock:{key}"
    lock_token = str(uuid.uuid4())
    got_lock = await redis.set(lock_key, lock_token, nx=True, ex=lock_ttl)

    if not got_lock:
        # Wait briefly for the holder to populate the cache
        for _ in range(20):
            await asyncio.sleep(0.05)
            cached = await redis.get(key)
            if cached is not None:
                return cached
        # Holder died or took too long — fall through and recompute
        return await compute()

    try:
        value = await compute()
        await redis.set(key, value, ex=ttl)
        return value
    finally:
        # Only release if we still own the lock (token check via Lua avoids races)
        await _release_lock(redis, lock_key, lock_token)


_RELEASE_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""

async def _release_lock(redis: Redis, key: str, token: str) -> None:
    await redis.eval(_RELEASE_SCRIPT, 1, key, token)
```

## Rate limiting

Owned by the `fastapi` skill: `fastapi/references/rate-limiting.md` — `slowapi` backed by Redis, never hand-rolled counter/token-bucket algorithms.

## Dedup window (idempotency)

```python
async def claim_idempotency_key(redis: Redis, key: str, ttl: int = 86400) -> bool:
    """Return True if we're the first to claim this key (good to proceed)."""
    return bool(await redis.set(f"idempotency:{key}", "1", nx=True, ex=ttl))
```

Pair with `background-jobs.md` § Make tasks idempotent.

## Don't cache what changes faster than you can serve it

Cache TTL must be shorter than the acceptable staleness, longer than the typical re-fetch interval. Keep them separate from object lifetimes — don't tie cache TTL to JWT expiry, session duration, or business deadlines.

## Gotchas

- **User-specific data under a shared key** serves one user's data to another — fold the user ID into the key (`user:{user_id}:prefs`).
- **A low hit rate means the cache only adds latency on the miss path** — emit hit/miss counters per key namespace (see `observability.md`) so you can tell.
- **`SETNX` + manual `EXPIRE` is a race** — the process can die between them, leaving a lock forever. Always use `SET NX EX` atomically.
- **Releasing a lock you no longer own** can release someone else's — verify the token via Lua before `DEL`.
- **Decoded vs binary responses** — `decode_responses=True` returns `str`; without it you get `bytes`. Pick one for the whole app.
- **`MULTI`/`EXEC` is not equivalent to a Lua script** — pipelined commands don't see each other's results. Use Lua for true atomic read-modify-write.
- **Cluster mode requires keys in the same hash slot** for multi-key operations — use hash tags `{user:42}:profile` to colocate related keys.
