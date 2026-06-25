# ra-skills

Agent Skills for the **Riksarkivet** (Swedish National Archives) **rask** HTR platform.

`ra-skills` is the single source of truth for the Claude Code / agent skills shared across
Riksarkivet's repos (`rask`, `ra-hcp`, `lance-audio`, …). It exists to stop skills from
**drifting** — before this repo, each project vendored its own copy of `writing-python`,
`dagger`, `fastapi`, … under `.claude/skills/`, and the copies silently diverged. Now every
repo consumes the skills from here, so there is one canonical version of each.

The repository follows the standardized [Agent Skills](https://agentskills.io/home) format and
is modeled on [`huggingface/skills`](https://github.com/huggingface/skills): each skill is a
self-contained folder with a `SKILL.md` (YAML frontmatter + guidance) and is published as its
own granular plugin.

## How skills work

A skill is a folder under `skills/<name>/` containing a `SKILL.md` with `name` + `description`
frontmatter and progressive-disclosure references under `references/`. Claude Code (in the
terminal, VS Code, or Zed) loads the `SKILL.md` when the description matches your intent.

> [!TIP]
> VS Code and Zed's native agents read the `AGENTS.md` standard — use the generated
> [`agents/AGENTS.md`](agents/AGENTS.md) bundle there.

## Installation

> You **consume** ra-skills as a **marketplace** — you never `git clone` or copy this repo into your
> project. Per-developer setup is below; for **committed, team-wide** config and **how to get the
> latest**, see [Updating & staying current](#updating--staying-current).

### Claude Code

```text
/plugin marketplace add AI-Riksarkivet/ra-skills
/plugin install <skill-name>@ra-skills
```

For example:

```text
/plugin install writing-python@ra-skills
/plugin install fastapi@ra-skills
```

### VS Code

The Claude Code VS Code extension reads the **same** marketplace — the
`/plugin marketplace add` + `/plugin install` commands above apply unchanged. For VS Code's
native agents (which read the `AGENTS.md` standard), drop the generated
[`agents/AGENTS.md`](agents/AGENTS.md) bundle into your project root.

### Zed

Run Claude Code in Zed via its external-agent (ACP) support — same marketplace commands as
above. For Zed's native agent, point it at the generated
[`agents/AGENTS.md`](agents/AGENTS.md) bundle.

> Scope: ra-skills targets the **Claude ecosystem** (Claude Code in the terminal, VS Code, and
> Zed) plus the `AGENTS.md` standard those editors consume. It deliberately ships **no** Gemini,
> Codex, or Cursor manifests.

## Updating & staying current

You pull skills **from the marketplace** — there is **no clone, no copy** into `.claude/skills/`.
Two ways to wire ra-skills into a consuming repo:

### Per-developer (quick)

```text
/plugin marketplace add AI-Riksarkivet/ra-skills      # one time
/plugin install gsap@ra-skills                         # install the skills you want
```

Get the latest:

```text
/plugin marketplace update ra-skills                   # refresh the catalog (picks up NEW skills)
/plugin install gsap@ra-skills                         # re-run install to bump an INSTALLED skill
/plugin list                                           # see what's installed + context cost
```

> **Refreshing the catalog ≠ updating installed skills.** `/plugin marketplace update` fetches the
> latest `marketplace.json` so newly added skills appear and become installable — but already-installed
> plugins do **not** auto-update by default for third-party marketplaces. Re-run
> `/plugin install <name>@ra-skills` to bump one, or turn on auto-update (below).

### Team-wide (committed — recommended)

Commit this to the **consuming** repo's `.claude/settings.json`. On a fresh checkout, once the
teammate trusts the folder, the marketplace auto-registers and the listed skills install
automatically — still no clone:

```json
{
  "extraKnownMarketplaces": {
    "ra-skills": {
      "source": { "source": "github", "repo": "AI-Riksarkivet/ra-skills" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "writing-python@ra-skills": true,
    "writing-typescript@ra-skills": true,
    "gsap@ra-skills": true
  }
}
```

`"autoUpdate": true` keeps installed skills current automatically (it's **off** by default for
third-party marketplaces, so set it explicitly). Pin to an exact release instead by adding
`"ref": "v1.2.3"` (a tag/branch/sha) under `source`.

### Getting *everything* (the full RA surface)

ra-skills is only **scope 1**. A fully-equipped checkout also needs the referenced marketplaces
(§2), the MCP servers (§3), and the vendor-CLI skills like Gradio (§4) — see
[What we use](#what-we-use--the-full-ra-claude-surface). That complete set is what
`make claude-bootstrap` wires up in each consuming repo (add new entries there as we adopt them, e.g.
the Gradio installer).

## Skills

ra-skills holds **only shared, reusable skills** (language + toolchain): `writing-python`,
`writing-typescript`, `fastapi`, `testing-python`, `python-infrastructure`, `otel`, `dagger`,
`dockerfile`, `turborepo`, `shadcn-svelte`, `micro-frontends`, `playwright-cli`, `architecture-diagram`, `gsap`, `zensical-setup`, `zensical-authoring`.

**Project-specific skills live with their project, not here** — e.g. rask's `rask-*`
architecture/pipeline/orchestrator skills are vendored in the rask repo's `.claude/skills/`, and
ra-hcp's `hcp-*` skills in ra-hcp. They evolve alongside that repo's code, so they don't belong in
the shared marketplace.

<!-- This table is auto-generated by scripts/generate_agents.py. Do not edit manually. -->
<!-- BEGIN_SKILLS_TABLE -->
| Name | Description | Documentation |
|------|-------------|---------------|
| `architecture-diagram` | Architecture diagrams for the rask platform as a single self-contained HTML file — interactive click-through flows (animated steps, mode toggles, side panel, drag) OR static export-ready topology snapshots with cloud/cluster/security-group/zone boundaries; both with built-in PNG/PDF/clipboard export. Biased to the RA stack: Ray, Argo Workflows, GitOps, Kubernetes, NATS JetStream, Dapr, Redis, FastAPI, SvelteKit, turborepo, micro-frontends, HF Hub, OpenTelemetry, the HTR pipeline. | [SKILL.md](skills/architecture-diagram/SKILL.md) |
| `dagger` | Dagger modules/functions in Go for container builds and CI/CD as typed, composable pipelines. | [SKILL.md](skills/dagger/SKILL.md) |
| `dockerfile` | Production dockerfiles — multi-stage discipline, BuildKit cache mounts, hadolint, the .docker build-context contract. | [SKILL.md](skills/dockerfile/SKILL.md) |
| `fastapi` | FastAPI + Pydantic production patterns: async, dependency injection, repositories, services, tests. | [SKILL.md](skills/fastapi/SKILL.md) |
| `gsap` | GSAP (GreenSock) animation for the SvelteKit frontend — biased to SvelteKit 2 + Svelte 5 (runes): tweens, timelines, ScrollTrigger (scroll reveals, parallax, pinning, scrub), and the now-free plugins (SplitText, Flip, Draggable, MorphSVG, ScrollSmoother). Svelte-first integration via the {@attach} pattern, gsap.context()/matchMedia() cleanup, SSR-safe setup, and Lenis smooth scroll, with copy-paste templates ($lib/gsap.ts, attachment factories, a golden-path component, a root +layout.svelte) and per-topic references. Original work; credits the official GreenSock gsap-skills (MIT). | [SKILL.md](skills/gsap/SKILL.md) |
| `micro-frontends` | Composing one UI from independently deployed frontends owned by separate teams: build-time / zones / server-side / client-side-runtime composition, Module Federation, single-spa, web components, cross-app communication, and when-to-use tradeoffs. | [SKILL.md](skills/micro-frontends/SKILL.md) |
| `otel` | OpenTelemetry for Python services — SDK setup, spans/metrics/logs, semantic conventions, the Collector pipeline. | [SKILL.md](skills/otel/SKILL.md) |
| `playwright-cli` | Drive a browser + author Playwright tests from the terminal via playwright-cli (Playwright MCP): navigate/click/fill/snapshot/eval, test generation, request mocking, tracing, storage-state, video. Official skill from @playwright/cli (Apache-2.0, Microsoft). | [SKILL.md](skills/playwright-cli/SKILL.md) |
| `python-infrastructure` | System-reliability Python: NATS JetStream jobs, Dapr workflows, tenacity retries, Redis cache, OTLP. | [SKILL.md](skills/python-infrastructure/SKILL.md) |
| `shadcn-svelte` | shadcn-svelte components + CLI: add/update/fix components, composition, forms, icons, styling, components.json (official skill from huntabyte/shadcn-svelte). | [SKILL.md](skills/shadcn-svelte/SKILL.md) |
| `testing-python` | pytest for the rask suite — importlib import-mode, explicit testpaths, the slow marker, async + respx HTTP mocking. | [SKILL.md](skills/testing-python/SKILL.md) |
| `turborepo` | Turborepo monorepo build system — turbo.json task pipelines, caching/remote cache, --filter/--affected, CI optimization, boundaries. | [SKILL.md](skills/turborepo/SKILL.md) |
| `writing-python` | Idiomatic Python 3.14+ — type safety, Pydantic-first patterns, error handling, config, CLI. | [SKILL.md](skills/writing-python/SKILL.md) |
| `writing-typescript` | Idiomatic TypeScript for the SvelteKit frontend + component lib — strict typing, Result types, Bun/Vite/Vitest. | [SKILL.md](skills/writing-typescript/SKILL.md) |
| `zensical-authoring` | Author Zensical docs: admonitions, superfences/mermaid, tabbed blocks, tasklists, grids, icons, front matter. | [SKILL.md](skills/zensical-authoring/SKILL.md) |
| `zensical-setup` | Set up and configure Zensical (zensical.toml): palette, nav, theme features, mkdocstrings, GitHub Pages deploy. | [SKILL.md](skills/zensical-setup/SKILL.md) |
<!-- END_SKILLS_TABLE -->

## What we use — the full RA Claude surface

> The canonical inventory of everything a Riksarkivet developer's Claude Code is expected to
> use. Three scopes; this section is the single place that documents them so a fresh checkout is
> reproducible. Per-repo `.claude/README.md` files point here rather than duplicating it.

### 1. RA-owned skills — **vendored here** (this repo)

The 16 skills above. Repos consume them as a marketplace (`/plugin install <name>@ra-skills`),
**not** by copying into `.claude/skills/` — that copy-vendoring is exactly what caused the drift
this repo fixes.

### 2. Third-party marketplaces — **referenced** (declared in each repo's committed `.claude/settings.json` → `extraKnownMarketplaces`)

| Marketplace | Source repo | Plugins we enable | Notes |
|---|---|---|---|
| `claude-code-toolkit` | `spences10/claude-code-toolkit` | `toolkit-skills`, `mcp-essentials`, `analytics` | skill activation hook, MCP setup, usage analytics |
| `astral-sh` | `astral-sh/claude-code-plugins` | `astral` | `ruff` / `ty` / `uv` skills — matches rask's Python toolchain |
| `svelte-skills-kit` | `spences10/svelte-skills-kit` | `svelte-skills` | runes, SvelteKit data flow, components, deployment |
| `huggingface-skills` | `huggingface/skills` | `hf-cli`, `huggingface-trackio` | rask pushes models/datasets to the HF Hub |
| `claude-plugins-official` | `anthropics/claude-plugins-official` | `redis-development` | Redis skill (the `redis-development` plugin lives here, **not** a separate `redis` marketplace) |

### 3. MCP servers — **registered separately** (not plugins)

| MCP | Package / URL | How it's registered | Scope |
|---|---|---|---|
| `svelte` (Svelte 5 MCP) | `bunx -y @sveltejs/mcp` | `make claude-bootstrap` → `claude mcp add -s local svelte` | local (per-developer, project) |
| `ra-mcp` (Riksarkivet MCP) | claude.ai-hosted | added per-developer if used | user (optional) |

### 4. Vendor-CLI skills — **self-installing** (run once per machine; self-updating)

Some tools ship their own official agent skill via a CLI installer. We **reference** these (run the
installer) rather than copy-vendoring them — they self-update, so a vendored copy would immediately
drift (the same reason §1 vendors only RA-owned skills). Run them at bootstrap (add to
`make claude-bootstrap`).

| Skill | Source | Install (per-developer, user scope) | Notes |
|---|---|---|---|
| `gradio` | `gradio-app/gradio` (official) | `uvx --with "huggingface_hub>=1.4.0" gradio skills add --claude --global` | Gradio core API + examples for ML demos / HF Spaces. Lands in `~/.agents/skills/gradio/`, symlinked into `~/.claude/skills/gradio/`; re-run with `--force` to update. Gradio is a **Python** CLI → run via **uv/uvx**, not bunx. |

### 5. Optional behavior overlays — **evaluated, not RA-owned**

General-purpose *behavior* skills (they change how the agent writes/talks, not RA domain
knowledge). **Not vendored or owned here** — they live in their own maintained marketplaces; this
table just records the team's evaluation so the decision isn't re-litigated.

| Skill | Source (MIT) | Verdict |
|---|---|---|
| **ponytail** | [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | **Optional — trial it per-developer.** A YAGNI / "don't over-build" overlay with a credible *agentic* benchmark (−54% LOC, −20% cost, 100% safe on a real FastAPI+React repo). Watch for friction with rask's deliberately-explicit `writing-python` / observability conventions. Try: `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail`. Do **not** make it a default. |
| **caveman** | [`juliusbrussee/caveman`](https://github.com/juliusbrussee/caveman) | **Evaluated, not adopted.** Compresses *output prose* only; ponytail's agentic benchmark shows caveman *raised* tokens/cost/time (+7% / +3% / +2%) in real agent loops, and terse "caveman" replies hurt review/handoff clarity. Personal user-scope novelty at most. |

### Dropped during unification (do **not** re-add)

`deno-skills@denoland-skills` (rask is Bun-only), the `svelte@svelte` plugin
(`sveltejs/ai-tools` — superseded by the Svelte MCP + `svelte-skills`), and
`svelte-flow@linehaulai-claude-marketplace` (aspirational, never installed). These were dangling
`enabledPlugins` entries whose marketplaces were never installed.

## Contributing

Hand-edit **only** `SKILL.md` files, `references/`, and `.claude-plugin/{marketplace.json,plugin.json}`.
Everything else is generated.

```bash
./scripts/publish.sh          # regenerate agents/AGENTS.md + the README skills table
./scripts/publish.sh --check  # CI drift-check (also run by .github/workflows/validate-artifacts.yml)
```

The generators are PEP-723 single-file `uv run` scripts (zero dependencies). Validation enforces
that every skill's frontmatter `name` equals its directory basename **and** its `marketplace.json`
entry — keep the three in lockstep.

## License

[Apache-2.0](LICENSE).
