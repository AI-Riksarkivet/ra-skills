---
name: architecture-diagram
version: 2.0.0
description: "Build architecture diagrams for the rask / Riksarkivet platform as a single self-contained HTML file — two modes from one skill. (1) INTERACTIVE click-through diagrams: animated step-by-step data flows, mode toggles (dev/prod · local/cloud · v1/v2), a side panel with payloads, dark/light theme, drag-to-reposition — for workshops, design reviews, onboarding, and designing a new service's flows before building. (2) STATIC export-ready topology snapshots: polished boxes-and-arrows with cloud-region / Kubernetes-cluster / security-group / micro-frontend-zone boundary containers — for decks, docs, and reports. BOTH modes have built-in PNG / PDF / clipboard export. Biased to the RA stack: Ray, Argo Workflows, GitOps (Argo CD), Kubernetes, NATS JetStream, Dapr, Redis, FastAPI, SvelteKit, turborepo, micro-frontends, HF Hub, OpenTelemetry, the HTR pipeline. Use when asked to visualize, design, or document a system: architecture diagram, service map, data/ETL flow, RAG/agentic flow, microservices or micro-frontend topology, HTR pipeline, CI/CD or GitOps deploy, onboarding diagram. NOT for static inline diagrams that belong in a markdown file (use a Mermaid flowchart) or hand-built slides."
license: MIT
---

# Architecture Diagrams (rask)

Build single-file, drop-in HTML pages that visualize how an RA system works. One skill, **two modes**:

- **Interactive** (`assets/template.html`) — let workshop attendees, reviewers, or new team members **click through** a system: animated data packets flow node-to-node, a side panel shows each step's payload, and mode toggles swap dev/prod · local/cloud · v1/v2 in place. The didactic, "watch what happens" diagram.
- **Static** (`assets/static-template.html`) — a polished dark **boxes-and-arrows topology snapshot** with grouping boundaries (cloud region, Kubernetes cluster, security group, micro-frontend zone). The export-it-to-a-deck diagram.

Both ship a built-in **export toolbar** (`⋯` → 📋 Copy / 🖼️ PNG / 📄 PDF) so any diagram lands cleanly in Slack, a doc, or a PDF report.

> **RA house style — go wide and generous.** Default to a **wide canvas** and spread nodes across the **full width**; size nodes large enough to read label + tech + port at a glance. The upstream layout skews small and narrow — deliberately push nodes apart, widen the canvas, and scale up. A diagram that fills the screen reads better in a workshop *and* exports to a crisper PNG/PDF. Cramped is the #1 failure mode here; when unsure, make it bigger.

---

## Step 0 — Pick the mode

First decision; everything else follows.

| The user wants to… | Mode | Template |
|---|---|---|
| Click through a flow step-by-step (workshop, onboarding, review) | **Interactive** | `template.html` |
| Show animated request/data flow with payloads at each hop | **Interactive** | `template.html` |
| Toggle dev/prod, local/cloud-run, or v1/v2 in one diagram | **Interactive** | `template.html` |
| Design a new service's flows/contracts before building it | **Interactive** | `template.html` |
| A clean infra/topology picture to paste into a deck or PDF | **Static** | `static-template.html` |
| Show Kubernetes-cluster / cloud-region / security-group groupings | **Static** | `static-template.html` |
| A one-shot snapshot for an onboarding doc or architecture report | **Static** | `static-template.html` |
| A static diagram that belongs **inline in a markdown file** | *Neither* — use a **Mermaid** flowchart/sequence diagram | — |

The differentiator: **interactivity + sequenced flow** → interactive; **a still picture to embed** → static; **inline in a `.md`** → Mermaid. When in doubt and the value is "step through it and watch", default to interactive — it can still export a static PNG/PDF of any step.

---

## The mental model

**Interactive** diagrams have four things:

1. **Nodes** — services, datastores, users, queues, jobs. Each has a **role** (color) and metadata (tech stack, port, deploy target).
2. **Flows** — named scenarios the viewer picks (`HTR Ingest`, `RAG Query`, `GitOps Deploy`, `Auth`). Each flow is an ordered list of **steps**.
3. **Steps** — `{from, to, color, title, route, payload, desc, chips}`. Each lights up one wire + one target node. `color` and `title` are required.
4. **Modes** — an orthogonal toggle (dev/prod, local/cloud, v1/v2) that swaps node labels, ports, payloads, or visibility in place. Modes are **deployment shape**, not alternative scenarios — flows are the scenarios.

**Static** diagrams have **nodes + arrows + boundaries** (no steps, no modes): hand-place SVG boxes inside grouping containers and draw labeled arrows between them. See `references/static-and-boundaries.md`.

---

## Workflow when invoked

### 1. Capture intent
If the user uploaded a SOLUTION.md, README, OpenAPI spec, `turbo.json`, k8s manifests, or an Argo `Workflow` YAML, **read it first**. Extract service names + tech + ports, deploy modes, named operations (→ flows), and the chain of internal calls per operation (→ steps). Then ask only the gaps:
- What system are we drawing, and who's the audience?
- (Interactive) Which flows? Any mode toggle (dev/prod, local/cloud)?
- (Static) Which groupings matter — cluster, namespace, region, MF zone?

### 2. Plan the topology first
Sketch which nodes exist, where they sit, and which flows connect them **before** writing code. **Avoid wire crossings** — the single biggest readability win. Heuristics: user on the far left (entry), datastores on the right (exit), the orchestrator/gateway in the middle; read-heavy services above, write-heavy below; one-shot jobs (seed, cron, Argo steps) tucked in a corner. Plan for a **wide** spread — use the whole canvas, not the middle third. See `references/flow-design-patterns.md`.

### 3. Build from the template
Copy the chosen template into the working directory and edit **only** the marked regions (each template's top `EDIT THESE THINGS` comment is authoritative). Don't reinvent the player, the SVG wire renderer, the side panel, the export toolbar, or the boundary primitives — they all work. Fill node lists from `references/ra-stack-library.md` (RA services) and `references/component-library.md` (generic services). After editing, search the file for `{{` / `[PROJECT NAME]` to catch stray placeholders.

### 4. Validate before showing the user
- Does every flow's step sequence make narrative sense (step 1 sets up, last step delivers a result)?
- **Is the canvas using the full width?** If nodes cluster in the middle third, spread them out — wide beats cramped. Keep **≥12% horizontal gap** between adjacent nodes.
- Do wires cross unnecessarily? Reposition nodes.
- (Modes) Pick the most-different node between modes (usually the datastore) and verify every mode-dependent field is filled (label, tech, port, payload, chips).
- (Static) Are legends/labels **outside** boundary boxes, and are arrows masked behind boxes (see static reference)?
- If puppeteer is available, screenshot to spot-check layout — `references/screenshot.js`.

### 5. Output the files
- Interactive → `architecture.html` **and** a companion `architecture.md` (components, flows step-by-step, mode differences) so the diagram is legible without opening the HTML.
- Static → `architecture.html` (the `.md` companion is optional for a pure snapshot).
- Save to the current working directory (on Claude.ai use `/mnt/user-data/outputs/`). Tell the user how to open it (`xdg-open architecture.html`) and that the `⋯` toolbar exports PNG/PDF.

---

## RA stack bias

This skill is tuned for the rask platform. Reach for these node identities and groupings first — full copy-paste snippets (roles, icons, ports, mode-aware fields) are in **`references/ra-stack-library.md`**:

| Area | Nodes to model | Default role / color |
|---|---|---|
| **Distributed compute** | Ray head + worker pool, **Ray Serve**, Ray Data | `compute` (magenta) |
| **Workflow orchestration** | **Argo Workflows** DAG/steps, the controller, per-step pods | `seed` for steps, `orch` for the controller |
| **GitOps / deploy** | Git repo → **Argo CD** / Flux → Kubernetes (sync, drift, rollback) | `orch` + `seed` for the sync job |
| **HTR pipeline** | segmentation → transcription → post-processing stages, page/line artifacts | `embed` for model stages, `vector` for artifact stores |
| **Edge / API** | FastAPI gateway/BFF, ingress/Traefik, Keycloak (OIDC) | `orch`, security via boundary |
| **Frontend** | SvelteKit apps, **turborepo** packages/apps, **micro-frontend** host + remotes/zones | `user` (mint) |
| **Messaging / async** | **NATS JetStream**, **Dapr** pub/sub & workflows | `vector` (violet) |
| **State** | Redis, Postgres | `vector` (violet) |
| **ML hub** | **Hugging Face Hub** (models/datasets push/pull) | `vector` / external |
| **Observability** | **OpenTelemetry** collector (OTLP), traces/metrics/logs | `orch`, drawn as a side concern |
| **CI/CD** | **Dagger** pipelines, GitHub Actions, container build/publish | `seed` (orange) |

**Cross-app communication (micro-frontends):** when drawing the frontend, model the composition seam explicitly — *events up, props down, shared bus, URL-as-state* — and namespace remotes by team (`@rask/web`, `@rask/viewer`). See the repo's `micro-frontends` and `turborepo` skills for the underlying patterns.

**Modes that fit RA:** `dev`/`prod`, `local`/`cloud-run`, `docker`/`k8s`, `v1`/`v2`. A mode is only a mode if it swaps the *same* topology's labels/ports/payloads — if it changes which services exist or which protocols are used, it's a **second system**: build two diagrams.

---

## Node roles & colors

Six roles, hardcoded as CSS variables. Pick one per node. **Keep the count ≤ 6** — past that the legend becomes a colorblind nightmare. If two datastores differ (Redis + Postgres), use `vector` for both and distinguish by icon/label, not a 7th color.

| Role | Color | Use for |
|---|---|---|
| `user` | mint `#46f9b8` | Browser, SvelteKit app, CLI, external caller |
| `orch` | sky `#6aa9ff` | FastAPI gateway/BFF, Argo CD, controller, OTel collector |
| `compute` | magenta `#ff6b8a` | Ray Serve, LLM, GPU inference, expensive compute |
| `embed` | amber `#ffc14d` | HTR model stage, embedding/preprocessing service |
| `vector` | violet `#b388ff` | Redis, Postgres, NATS, Dapr, vector/blob store, HF Hub |
| `seed` | orange `#ff9457` | Argo Workflow step, Dagger/CI job, cron, seed/migration |

Re-skin via `assets/css-tokens.css` (light theme + muted/corporate palettes).

---

## Boundaries & grouping (mined from the static path)

Flat node lists can't show "these run **inside** the cluster" or "this is a separate security zone." The **static** template ships four boundary primitives — use them to capture RA topology nuance:

- **Cloud region / Kubernetes cluster** — large dashed `rx=12` container (amber). Label top-left, *outside* the inner nodes.
- **Security group / NetworkPolicy** — dashed `rx=8` (rose), transparent fill.
- **Micro-frontend zone** — a boundary around a team's host + remotes to show the composition seam.
- **Message bus / event connector** — a thin labeled bar (orange) in the gap between services (NATS / Dapr).

Full SVG recipes (z-order, masking arrows behind translucent boxes, spacing math, legend placement, summary cards) are in **`references/static-and-boundaries.md`**.

---

## Export (both modes)

Every generated diagram has a collapsed `⋯` toolbar (top-right) → **Copy** (high-DPI PNG to clipboard), **PNG** (download), **PDF** (one-page, dark theme preserved). It uses pinned, SRI-hashed `html2canvas` + `jsPDF` from jsDelivr.

Caveats to tell the user: clipboard needs a **user gesture + secure context** (https / `file://` / localhost); **offline**, the export buttons no-op (CDN unreachable) but the diagram still renders; PDF is a rasterized PNG (not selectable text). The interactive diagram exports a snapshot of the **current step** — set the step/mode/theme first, then export.

---

## Conventions (quick reference)

- **Payloads** (interactive side panel): realistic but trimmed — show the shape, omit boring fields. 4-space indent. If a step differs by mode, use `payloadDev`/`payloadProd` (or your mode keys); otherwise one `payload`.
- **Chips**: ≤3 short metadata badges per step. Latency (`~150ms`, `5-30s`) auto-gets a stopwatch icon; size/count (`768 dim`, `38 loaded`) a database icon.
- **Naming**: flow keys `snake_case` (`htr_ingest`, `rag_query`); flow display `"Title Case (METHOD /route)"`; node `data-id` short `snake_case` (`orch`, `ray`, `nats`); mode keys `snake_case` (`dev`/`prod`).

---

## Common pitfalls

- **`</script>` in a payload breaks the page.** A payload template literal containing `</script>` (or `</style>`) closes the main script block. Escape as `<\/script>`.
- **Cramped / narrow diagrams.** The most common complaint. There's **no hard node cap** — the only number is a **≥12% horizontal-gap** spacing rule (not a node count). Spread nodes across the full width, scale them up, and split a sprawling system into per-area diagrams ("ingest" vs "serving") rather than squeezing everything in.
- **Too many flows.** >6 flows clutter the tab bar; 3–6 is the sweet spot. Group read vs write flows into separate files if needed.
- **Modes that aren't modes.** If the toggle changes which services exist or the protocol, it's a second system — build two diagrams.
- **Source node looks dead.** If a step's source renders dimmed instead of `active-from`, the participant logic regressed — see `references/flow-design-patterns.md` → "Visual states".
- **Wire crossings** come from node placement, not code — swap node positions to fix.
- **Static: arrows show through boxes.** Component fills are translucent, so draw arrows first, then an opaque backing rect under each box (the static reference documents this masking trick) and keep legends outside boundary boxes.
- **Wrong tool.** If it must live inline in a markdown file, a Mermaid flowchart is simpler — this skill produces standalone HTML.

---

## File reference

| File | When to read |
|---|---|
| `assets/template.html` | **Interactive mode.** Copy + edit the marked regions. Has the player, side panel, modes, drag, export toolbar. |
| `assets/static-template.html` | **Static mode.** Copy + edit. Has boundary containers, summary cards, export toolbar. |
| `assets/css-tokens.css` | Restyle (light theme, brand colors). Standalone tokens. |
| `references/ra-stack-library.md` | **RA nodes** — copy-paste snippets for Ray, Argo Workflows, GitOps/Argo CD, NATS, Dapr, FastAPI, SvelteKit, turborepo/MF, HF Hub, OTel, HTR stages. |
| `references/static-and-boundaries.md` | **Static craft** — boundary primitives (cluster/region/security-group/zone), SVG z-order & arrow masking, spacing, legend, summary cards, export internals. |
| `references/flow-design-patterns.md` | Planning a system from scratch: node placement, flow vs step, sequencing, mode design, visual states. |
| `references/component-library.md` | Generic node snippets (Postgres, Kafka, S3, LLM, cron, …) when a service isn't RA-specific. |
| `references/screenshot.js` | Spot-check layout with puppeteer before showing the user (optional). |
| `examples/*.json` | Planning specs you translate into the template — RA ones (`rask-*`, `ra-*`) plus generic flows (auth, event-driven, CI/CD). Outlines, **not** drop-in code. |

---

*Built on MIT-licensed work (konraddzbik/architecture-diagram-skill for the interactive engine; Cocoon-AI/architecture-diagram-generator for the static/export path), combined and RA-tuned. See `LICENSE`.*
