<skills>

You have additional SKILLs documented in directories containing a "SKILL.md" file.

These skills are:
 - dagger -> "skills/dagger/SKILL.md"
 - dockerfile -> "skills/dockerfile/SKILL.md"
 - fastapi -> "skills/fastapi/SKILL.md"
 - micro-frontends -> "skills/micro-frontends/SKILL.md"
 - otel -> "skills/otel/SKILL.md"
 - playwright-cli -> "skills/playwright-cli/SKILL.md"
 - python-infrastructure -> "skills/python-infrastructure/SKILL.md"
 - shadcn-svelte -> "skills/shadcn-svelte/SKILL.md"
 - testing-python -> "skills/testing-python/SKILL.md"
 - turborepo -> "skills/turborepo/SKILL.md"
 - writing-python -> "skills/writing-python/SKILL.md"
 - writing-typescript -> "skills/writing-typescript/SKILL.md"
 - zensical-authoring -> "skills/zensical-authoring/SKILL.md"
 - zensical-setup -> "skills/zensical-setup/SKILL.md"

IMPORTANT: You MUST read the SKILL.md file whenever the description of the skills matches the user intent, or may help accomplish their task. 

<available_skills>

dagger: `Write Dagger modules and functions in Go for container builds, CI/CD pipelines, and workflow automation. Use when: dagger, dagger module, dagger function, dagger call, dagger shell, dagger init, CI/CD pipeline as code, container build with dagger, publish container image, dagger SDK, daggerverse, dagger toolchain, dagger Go SDK, programmable CI, build-test-push pipeline, dagger.json, dag.Container, dag.Directory, multi-stage container build, dagger cloud, trivy scan, SBOM generation, vulnerability scanning, provenance attestation, cosign signing, supply chain security, docker compose dagger, service binding, dagger-for-github action, publish docker registry, publish pypi. Also use when the user wants to replace shell scripts or YAML CI configs with typed, composable Go code that runs identically locally and in CI.`
dockerfile: `Author production dockerfiles. Use when adding a new containerized image, modifying a *.dockerfile, debugging a slow/large build, or reviewing a dockerfile for security and cache efficiency. Enforces the .docker/<name>.dockerfile + repo-root build-context contract (the RA/rask convention) consumed by the dagger build system.`
fastapi: `FastAPI best practices, conventions, and production project templates. Use when writing or refactoring FastAPI APIs and Pydantic models, or when scaffolding a new FastAPI project with async patterns, dependency injection, repositories, services, auth, and tests.`
micro-frontends: `Composing one web UI from independently built and deployed frontends owned by separate teams. Covers the integration techniques (build-time, server-side, client-side runtime — iframes, web components, Module Federation, import maps), routing and orchestration (single-spa, app shell), cross-app communication, and the when-to-use tradeoffs. Use when splitting a frontend across teams, choosing between Module Federation / single-spa / server-side composition, integrating fragments from multiple apps, or migrating a frontend monolith incrementally.`
otel: `OpenTelemetry for Python services in this project — SDK setup, auto-instrumentation, custom spans/metrics/logs, semantic conventions, and the Collector pipeline that consumes the data. Use when instrumenting a Python service with traces/metrics/logs, picking attribute names, debugging missing telemetry, or deciding what belongs in the SDK vs the Collector.`
playwright-cli: `Automate browser interactions, test web pages and work with Playwright tests.`
python-infrastructure: `Python patterns for system reliability — background jobs and task queues (NATS JetStream via nats-py), durable multi-step workflows (Dapr Workflow via dapr-ext-workflow), resilience and recovery (retries, backoff, timeouts, circuit breakers via tenacity), caching (Redis), and observability (OpenTelemetry traces, metrics, logs via OTLP). USE WHEN building async workers, queueing tasks, designing fault-tolerant multi-step workflows that must survive crashes, handling transient network/IO failures, instrumenting Python services for production, designing retry policies, configuring tracing/metrics, or caching with Redis. NOT FOR language idioms or type hygiene (use `writing-python`), HTTP routing (use `fastapi`), or deep OTel reference (use `otel`).`
shadcn-svelte: `Manages shadcn-svelte components and projects — adding, updating, fixing, debugging, styling, and composing UI. Provides project context, component docs, and usage examples. Applies when working with shadcn-svelte, the CLI, design-system presets, or any project with a components.json file. Also triggers for "shadcn-svelte init", "add component", or registry URLs.`
testing-python: `pytest in the rask monorepo — the non-default config (importlib import-mode, explicit testpaths, the 'slow' marker, explicit @pytest.mark.asyncio), running single tests, moto for S3, respx for HTTPX. Use when writing or running Python tests in rask, debugging collection/import errors, marking slow model-loading tests, or wiring async/DB/S3/HTTP fixtures.`
turborepo: `Turborepo monorepo build system guidance. Triggers on: turbo.json, task pipelines, dependsOn, caching, remote cache, the "turbo" CLI, --filter, --affected, CI optimization, environment variables, internal packages, monorepo structure/best practices, and boundaries. Use when user: configures tasks/workflows/pipelines, creates packages, sets up monorepo, shares code between apps, runs changed/affected packages, debugs cache, or has apps/packages directories.`
writing-python: `Idiomatic Python 3.14+ — language style, type safety, design patterns, anti-patterns, error handling, resource management, configuration, CLI, and testing. Pydantic-first (no dataclasses). Use when writing or reviewing Python code, scaffolding services or CLI tools, designing validation/exception strategies, externalizing config, or establishing project conventions. NOT FOR system-reliability concerns like background jobs, retries, or observability (use `python-infrastructure`).`
writing-typescript: `Idiomatic TypeScript for this project — strict typing, `unknown` over `any`, Result types over throwing, composition, Bun/Vite/Vitest toolchain. Use when writing or reviewing TypeScript code in the SvelteKit frontend (`components/apps/frontend/`) or the component library (`packages/oxen_componets/`). Defers Svelte-specific concerns (runes, routing, components) to the `svelte-skills:*` plugin.`
zensical-authoring: `Guide for writing documentation content with Zensical's Markdown extensions. Use when: write docs with admonitions, code blocks, content tabs, diagrams, grids, icons, emojis, math equations, data tables, footnotes, tooltips, buttons, images, lists, task lists, formatting, front matter, Mermaid diagrams.`
zensical-setup: `Guide for setting up and configuring Zensical documentation sites. Use when: create documentation site, configure zensical.toml, set up navigation, change theme colors, configure fonts, add analytics, deploy docs site, GitHub Pages, GitLab Pages, mkdocs.yml migration, customize Zensical theme, template overrides, add CSS or JavaScript.`
</available_skills>

Paths referenced within SKILL folders are relative to that SKILL. For example the hf-datasets `scripts/example.py` would be referenced as `hf-datasets/scripts/example.py`. 

</skills>
