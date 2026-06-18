<skills>

You have additional SKILLs documented in directories containing a "SKILL.md" file.

These skills are:
 - dagger -> "skills/dagger/SKILL.md"
 - dockerfile -> "skills/dockerfile/SKILL.md"
 - fastapi -> "skills/fastapi/SKILL.md"
 - otel -> "skills/otel/SKILL.md"
 - python-infrastructure -> "skills/python-infrastructure/SKILL.md"
 - rask-architecture -> "skills/rask-architecture/SKILL.md"
 - rask-htr-pipeline -> "skills/rask-htr-pipeline/SKILL.md"
 - rask-orchestrator -> "skills/rask-orchestrator/SKILL.md"
 - rask-services-fleet -> "skills/rask-services-fleet/SKILL.md"
 - testing-python -> "skills/testing-python/SKILL.md"
 - writing-python -> "skills/writing-python/SKILL.md"
 - writing-typescript -> "skills/writing-typescript/SKILL.md"
 - zensical-authoring -> "skills/zensical-authoring/SKILL.md"
 - zensical-setup -> "skills/zensical-setup/SKILL.md"

IMPORTANT: You MUST read the SKILL.md file whenever the description of the skills matches the user intent, or may help accomplish their task. 

<available_skills>

dagger: `>`
dockerfile: `Author production dockerfiles. Use when adding a new containerized image, modifying a *.dockerfile, debugging a slow/large build, or reviewing a dockerfile for security and cache efficiency. Enforces the .docker/<name>.dockerfile + repo-root build-context contract (the RA/rask convention) consumed by the dagger build system.`
fastapi: `FastAPI best practices, conventions, and production project templates. Use when writing or refactoring FastAPI APIs and Pydantic models, or when scaffolding a new FastAPI project with async patterns, dependency injection, repositories, services, auth, and tests.`
otel: `OpenTelemetry for Python services in this project — SDK setup, auto-instrumentation, custom spans/metrics/logs, semantic conventions, and the Collector pipeline that consumes the data. Use when instrumenting a Python service with traces/metrics/logs, picking attribute names, debugging missing telemetry, or deciding what belongs in the SDK vs the Collector.`
python-infrastructure: `Python patterns for system reliability — background jobs and task queues (NATS JetStream via nats-py), durable multi-step workflows (Dapr Workflow via dapr-ext-workflow), resilience and recovery (retries, backoff, timeouts, circuit breakers via tenacity), caching (Redis), and observability (OpenTelemetry traces, metrics, logs via OTLP). USE WHEN building async workers, queueing tasks, designing fault-tolerant multi-step workflows that must survive crashes, handling transient network/IO failures, instrumenting Python services for production, designing retry policies, configuring tracing/metrics, or caching with Redis. NOT FOR language idioms or type hygiene (use `writing-python`), HTTP routing (use `fastapi`), or deep OTel reference (use `otel`).`
rask-architecture: `The rask Polylith brick layers (packages/components/projects) and the entrypoint-over-brick composition contract — service-kit's make_service_app + injectable lifespan. Use when adding/moving a brick or service, editing a pyproject.toml or workspace member list, wiring a new entrypoint, debugging "module not found"/uv-resolution after adding code, or deciding where new code belongs (lib vs runnable vs deployable).`
rask-htr-pipeline: `The rask HTR image→ALTO pipeline — Ray Data actor fan-out + Ray Serve TrOCR/HTRflow GPU packing, the hard-won OOM and concurrency lessons. Use when editing components/apps/runner/pipeline.py, transcribe_service.py, or htrflow_service.py; tuning GPU fractions / replica counts / actor pool sizes / transcribe batch; retargeting to different GPU hardware; or debugging a raylet-killing OOM, idle GPUs, or ALTO that lands late in S3.`
rask-orchestrator: `The rask orchestrator — the reconcile→derive→submit loop that drives the HTR pipeline (IIIF → ALTO) for the Swedish National Archives. Use when changing the orchestrator tick, its idempotency/single-writer invariants, the two-lane prefetch/htr slot model, the htr-readiness gate, the runtime start/stop + per-chunk stop endpoints, or the NATS JetStream roadmap. Covers `core/services/orchestrator/{loop,derive}.py`, `services/{submission,sync}.py`, and the single `batches` table the loop reads.`
rask-services-fleet: `The rask backend topology — gateway (:8888) reverse-proxy + per-domain services (core-api, orchestrator, search, volumes, ray) and how they're wired. Use when adding/moving an endpoint, debugging a 404/502 from the SPA, changing a port or RASK_*_URL override, deciding which process owns the batches table, or reading dev-micro.sh.`
testing-python: `pytest in the rask monorepo — the non-default config (importlib import-mode, explicit testpaths, the 'slow' marker, explicit @pytest.mark.asyncio), running single tests, moto for S3, respx for HTTPX. Use when writing or running Python tests in rask, debugging collection/import errors, marking slow model-loading tests, or wiring async/DB/S3/HTTP fixtures.`
writing-python: `Idiomatic Python 3.14+ — language style, type safety, design patterns, anti-patterns, error handling, resource management, configuration, CLI, and testing. Pydantic-first (no dataclasses). Use when writing or reviewing Python code, scaffolding services or CLI tools, designing validation/exception strategies, externalizing config, or establishing project conventions. NOT FOR system-reliability concerns like background jobs, retries, or observability (use `python-infrastructure`).`
writing-typescript: `Idiomatic TypeScript for this project — strict typing, `unknown` over `any`, Result types over throwing, composition, Bun/Vite/Vitest toolchain. Use when writing or reviewing TypeScript code in the SvelteKit frontend (`components/apps/frontend/`) or the component library (`packages/oxen_componets/`). Defers Svelte-specific concerns (runes, routing, components) to the `svelte-skills:*` plugin.`
zensical-authoring: `>`
zensical-setup: `>`
</available_skills>

Paths referenced within SKILL folders are relative to that SKILL. For example the hf-datasets `scripts/example.py` would be referenced as `hf-datasets/scripts/example.py`. 

</skills>
