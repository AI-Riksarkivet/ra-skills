# RA Stack Library

The RA-biased companion to `component-library.md` — copy-paste node snippets for the rask / Riksarkivet on-prem HTR platform (Ray, Argo, GitOps, Kubernetes, NATS, Dapr, HF Hub, the HTR pipeline). Same snippet structure as `component-library.md`: each entry is a `.node` div with a `data-role`, a `data-id`, an inline `left/top` position, a 14×14 Feather-style `.icon` SVG (`stroke="currentColor"`, so the glyph inherits the role color), then `.label` / `.tech` / `.port`, and a trailing `<span class="step-badge">·</span>`. Reach for these RA identities *first*; fall back to the generic snippets in `component-library.md` only when a service isn't RA-specific.

**Roles** (six, no more) and their colors come straight from `SKILL.md`: `user` mint, `orch` sky, `compute` magenta, `embed` amber, `vector` violet, `seed` orange. Two datastores that differ (Redis + Postgres) both use `vector` and are told apart by icon/label — never a 7th color. Where a node changes between modes, mirror the mode-aware pattern in `component-library.md` (its Qdrant node uses `data-label-offline`/`-online`; substitute your own mode keys, e.g. `data-label-dev`/`-prod`), with matching `data-tech-*` / `data-port-*` on the relevant child div.

**Typical RA layout** — read it left-to-right as a flow: user far-left → ingress / Keycloak / FastAPI gateway mid-left → Ray Serve / HTR stages mid → NATS / Redis / Postgres right → HF Hub far-right; CI / Argo tucked into the top corners. The ≤6-role cap is about distinct *colors*, not node count — e.g. the three HTR stages (segmentation / transcription / post-processing) may each be a separate `embed` node without breaching the cap.

---

## Distributed compute — Ray (role=compute)

Ray is the rask compute backbone. Model it as three nodes: the **head** (cluster brain + dashboard + GCS), the **worker pool** (the actual actors/tasks, scales out), and **Ray Serve** (the online inference deployment graph). All three are `compute` (magenta) — distinguish by icon and label.

### Ray head node

```html
<div class="node" data-role="compute" data-id="ray_head" style="left: 60%; top: 20%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M12 8V2"/><path d="M12 22v-6"/><path d="M16.24 7.76L20.49 3.51"/><path d="M3.51 20.49l4.25-4.25"/><path d="M7.76 7.76L3.51 3.51"/><path d="M20.49 20.49l-4.25-4.25"/></svg>
  </div>
  <div class="label">Ray Head</div>
  <div class="tech">GCS · scheduler · autoscaler</div>
  <div class="port">:8265 dash · :10001 client</div>
  <span class="step-badge">·</span>
</div>
```

### Ray worker pool

```html
<div class="node" data-role="compute" data-id="ray_workers" style="left: 78%; top: 20%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
  </div>
  <div class="label">Ray Workers</div>
  <div class="tech" data-tech-dev="raylet · 1 node · CPU" data-tech-prod="raylet · GPU pool · autoscale">raylet · GPU pool · autoscale</div>
  <div class="port" data-port-dev="1 worker" data-port-prod="N pods · A100">N pods · A100</div>
  <span class="step-badge">·</span>
</div>
```

### Ray Serve

```html
<div class="node" data-role="compute" data-id="ray_serve" style="left: 78%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
  </div>
  <div class="label">Ray Serve</div>
  <div class="tech">deployment graph · HTR models</div>
  <div class="port">:8000 (HTTP) · :8265</div>
  <span class="step-badge">·</span>
</div>
```

### Ray Data

Batch/streaming dataset layer that fans scanned pages into the HTR pipeline — reads from the artifact store, maps the per-page preprocessing, and feeds Ray Serve / Ray Train. `compute` (magenta), distinguished by the layered-dataset icon.

```html
<div class="node" data-role="compute" data-id="ray_data" style="left: 60%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>
  </div>
  <div class="label">Ray Data</div>
  <div class="tech">streaming Dataset · map_batches · page fan-out</div>
  <div class="port">blocks · prefetch · → Serve/Train</div>
  <span class="step-badge">·</span>
</div>
```

---

## Workflow orchestration — Argo Workflows

The controller reconciles `Workflow` CRDs (`orch`, sky); each DAG/step pod is a one-shot job (`seed`, orange). Tuck the steps in a corner per the placement heuristics in `SKILL.md`.

### Argo Workflows controller (role=orch)

```html
<div class="node" data-role="orch" data-id="argo_wf" style="left: 40%; top: 18%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  </div>
  <div class="label">Argo Workflows</div>
  <div class="tech">workflow-controller · DAG</div>
  <div class="port">:2746 (UI/API)</div>
  <span class="step-badge">·</span>
</div>
```

### Argo Workflow step (role=seed)

```html
<div class="node" data-role="seed" data-id="argo_step" style="left: 40%; top: 4%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  </div>
  <div class="label">Workflow Step</div>
  <div class="tech">step pod · container template</div>
  <div class="port">one-shot · artifacts</div>
  <span class="step-badge">·</span>
</div>
```

---

## GitOps / deploy — Argo CD

The deploy seam: a **Git repo** is the source of truth (`orch`), **Argo CD** continuously reconciles desired vs live state (`orch`), and the **sync / rollout job** that actually applies manifests to the cluster is one-shot (`seed`). Use Flux interchangeably with Argo CD — same shape.

### Git repo source (role=orch)

```html
<div class="node" data-role="orch" data-id="git_repo" style="left: 4%; top: 18%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
  </div>
  <div class="label">Git Repo (manifests)</div>
  <div class="tech">desired state · Kustomize/Helm</div>
  <div class="port">main @ rev</div>
  <span class="step-badge">·</span>
</div>
```

### Argo CD sync (role=orch)

```html
<div class="node" data-role="orch" data-id="argocd" style="left: 24%; top: 18%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
  </div>
  <div class="label">Argo CD</div>
  <div class="tech">reconcile · drift detect · rollback</div>
  <div class="port">:8080 (API/UI)</div>
  <span class="step-badge">·</span>
</div>
```

### Sync / rollout job (role=seed)

```html
<div class="node" data-role="seed" data-id="sync_job" style="left: 24%; top: 4%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
  </div>
  <div class="label">Sync / Rollout</div>
  <div class="tech">kubectl apply · health gate</div>
  <div class="port">one-shot → cluster</div>
  <span class="step-badge">·</span>
</div>
```

---

## Edge / Kubernetes — ingress, auth, gateway (role=orch)

The cluster front door. Ingress/Traefik terminates TLS and routes; Keycloak handles OIDC; the FastAPI gateway/BFF fans requests in to internal services. All `orch` (sky) — the security boundary is drawn with a static container, not a 7th color (see `static-and-boundaries.md`).

### Kubernetes ingress / Traefik

```html
<div class="node" data-role="orch" data-id="ingress" style="left: 16%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  </div>
  <div class="label">Ingress / Traefik</div>
  <div class="tech">IngressRoute · TLS · k8s</div>
  <div class="port">:443 → :80</div>
  <span class="step-badge">·</span>
</div>
```

### Keycloak / OIDC

```html
<div class="node" data-role="orch" data-id="keycloak" style="left: 16%; top: 18%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  </div>
  <div class="label">Keycloak</div>
  <div class="tech">OIDC · realm · JWT</div>
  <div class="port">:8080 /realms/rask</div>
  <span class="step-badge">·</span>
</div>
```

### FastAPI gateway / BFF

```html
<div class="node" data-role="orch" data-id="gateway" style="left: 30%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  </div>
  <div class="label">FastAPI Gateway (BFF)</div>
  <div class="tech">Python · Pydantic · async</div>
  <div class="port">:8000 /api</div>
  <span class="step-badge">·</span>
</div>
```

---

## Frontend — SvelteKit, turborepo, micro-frontends (role=user)

All three are `user` (mint). Model the micro-frontend composition seam explicitly — *events up, props down, shared bus, URL-as-state* — and namespace remotes by team (`@rask/web`, `@rask/viewer`). Wrap the host + its remotes in a micro-frontend-zone boundary (static mode) to show the seam.

### SvelteKit app

```html
<div class="node" data-role="user" data-id="sveltekit" style="left: 4%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  </div>
  <div class="label">SvelteKit App</div>
  <div class="tech" data-tech-dev="vite dev · HMR" data-tech-prod="adapter-node · SSR">adapter-node · SSR</div>
  <div class="port" data-port-dev=":5173" data-port-prod=":3000">:3000</div>
  <span class="step-badge">·</span>
</div>
```

### Micro-frontend host

```html
<div class="node" data-role="user" data-id="mf_host" style="left: 4%; top: 20%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
  </div>
  <div class="label">MF Host (shell)</div>
  <div class="tech">@rask/web · turborepo · shared bus</div>
  <div class="port">URL-as-state · props↓</div>
  <span class="step-badge">·</span>
</div>
```

### Micro-frontend remote

```html
<div class="node" data-role="user" data-id="mf_remote" style="left: 4%; top: 56%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
  </div>
  <div class="label">MF Remote (viewer)</div>
  <div class="tech">@rask/viewer · lazy zone</div>
  <div class="port">events↑ · remoteEntry.js</div>
  <span class="step-badge">·</span>
</div>
```

---

## Messaging / async — NATS, Dapr (role=vector)

Async backbone. NATS JetStream is the durable event/stream layer; the Dapr sidecar fronts pub/sub, state, and service invocation over a uniform building-block API. Both `vector` (violet) — distinguish by icon. Optionally draw NATS/Dapr as a thin labeled message-bus bar between services (static mode).

### NATS JetStream

```html
<div class="node" data-role="vector" data-id="nats" style="left: 52%; top: 56%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="2"/></svg>
  </div>
  <div class="label">NATS JetStream</div>
  <div class="tech">stream · durable consumer · subjects</div>
  <div class="port">:4222 (client) · :8222 (mon)</div>
  <span class="step-badge">·</span>
</div>
```

### Dapr sidecar / pub-sub

```html
<div class="node" data-role="vector" data-id="dapr" style="left: 52%; top: 72%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M3 16v5h5"/><path d="M16 21h5v-5"/><circle cx="12" cy="12" r="3"/></svg>
  </div>
  <div class="label">Dapr Sidecar</div>
  <div class="tech">pub/sub · state · invoke (NATS comp.)</div>
  <div class="port">:3500 HTTP · :50001 gRPC</div>
  <span class="step-badge">·</span>
</div>
```

---

## State — Redis, Postgres (role=vector)

Both stores are `vector` (violet); the cache lightning-bolt icon vs the database-cylinder icon tells them apart — not a 7th color.

### Redis

```html
<div class="node" data-role="vector" data-id="redis" style="left: 66%; top: 56%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  </div>
  <div class="label">Redis</div>
  <div class="tech">cache · streams · TTL</div>
  <div class="port">:6379</div>
  <span class="step-badge">·</span>
</div>
```

### Postgres

```html
<div class="node" data-role="vector" data-id="postgres" style="left: 66%; top: 72%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>
  </div>
  <div class="label">Postgres</div>
  <div class="tech">16.x · documents · pages · jobs</div>
  <div class="port">:5432</div>
  <span class="step-badge">·</span>
</div>
```

---

## ML hub — Hugging Face Hub (role=vector)

The external model/dataset registry the HTR stages pull weights from and push fine-tunes to. `vector` (violet), drawn as an external dependency on the right edge.

### Hugging Face Hub

```html
<div class="node" data-role="vector" data-id="hf_hub" style="left: 90%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
  </div>
  <div class="label">Hugging Face Hub</div>
  <div class="tech">External · models · datasets</div>
  <div class="port">huggingface.co · pull/push</div>
  <span class="step-badge">·</span>
</div>
```

---

## Observability — OpenTelemetry collector (role=orch)

A side concern, not part of the mainline flow. `orch` (sky), placed above or below the flow per `SKILL.md`. Include only when observability is the topic of the flow.

### OpenTelemetry collector

```html
<div class="node" data-role="orch" data-id="otel" style="left: 40%; top: 88%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
  </div>
  <div class="label">OTel Collector</div>
  <div class="tech">traces · metrics · logs (OTLP)</div>
  <div class="port">:4317 gRPC · :4318 HTTP</div>
  <span class="step-badge">·</span>
</div>
```

---

## HTR pipeline stages (role=embed)

The heart of the platform: scanned page → segmentation → transcription → post-processing → structured text. Each model stage is `embed` (amber); the artifact stores between them are `vector`. Place the three stages left-to-right so the pipeline reads as a flow.

### Segmentation

```html
<div class="node" data-role="embed" data-id="htr_seg" style="left: 36%; top: 56%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
  </div>
  <div class="label">Segmentation</div>
  <div class="tech">layout · regions · baselines</div>
  <div class="port">page → lines</div>
  <span class="step-badge">·</span>
</div>
```

### Transcription

```html
<div class="node" data-role="embed" data-id="htr_trans" style="left: 36%; top: 72%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
  </div>
  <div class="label">Transcription</div>
  <div class="tech">TrOCR / HTR model · line → text</div>
  <div class="port">~5-30s/page · GPU</div>
  <span class="step-badge">·</span>
</div>
```

### Post-processing

```html
<div class="node" data-role="embed" data-id="htr_post" style="left: 36%; top: 88%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/><path d="M14 4h6v6"/></svg>
  </div>
  <div class="label">Post-processing</div>
  <div class="tech">normalize · ALTO/PAGE XML · confidence</div>
  <div class="port">text → structured</div>
  <span class="step-badge">·</span>
</div>
```

---

## Model & training blocks (ML lens)

**Scope.** This lens is for *high-level* model / training-pipeline diagrams — draw the forward pass or the training loop as a flow where each step is a block, tensor shapes ride along as side-panel payloads, and train/eval are modes. It is **not** a per-layer neural-net graph: for computational graphs / tensor-shape stacks use [torchview](https://github.com/mert-kurttutan/torchview), Netron (on an exported ONNX), `torchinfo.summary()`, or [PlotNeuralNet](https://github.com/HarisIqbal88/PlotNeuralNet).

Framed around the rask HTR model — a TrOCR-style image-encoder → text-decoder (equivalently a segmentation backbone + transcription head). The DataLoader feeds the model, the model's blocks are `embed` (amber), the loss is `compute`, the backward/optimizer step and DataLoader are `seed` (one-shot per step), and the checkpoint store is `vector`. The **model registry is the existing HF Hub node** (role=vector, above) — point checkpoints at it rather than drawing a new registry.

### DataLoader (role=seed)

```html
<div class="node" data-role="seed" data-id="dataloader" style="left: 4%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><line x1="12" y1="22" x2="12" y2="12"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
  </div>
  <div class="label">DataLoader</div>
  <div class="tech">collate · augment · shuffle</div>
  <div class="port" data-port-train="batch [B,3,H,W]" data-port-eval="batch [1,3,H,W]">batch [B,3,H,W]</div>
  <span class="step-badge">·</span>
</div>
```

### Backbone / image encoder (role=embed)

```html
<div class="node" data-role="embed" data-id="backbone" style="left: 22%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
  </div>
  <div class="label">Image Encoder</div>
  <div class="tech">ViT / ResNet backbone · patch embed</div>
  <div class="port">[B,3,H,W] → [B,768,h,w]</div>
  <span class="step-badge">·</span>
</div>
```

### Transformer encoder/decoder block (role=embed)

```html
<div class="node" data-role="embed" data-id="transformer" style="left: 40%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="15" width="18" height="6" rx="1"/><line x1="12" y1="9" x2="12" y2="15"/></svg>
  </div>
  <div class="label">Transformer Decoder</div>
  <div class="tech">self-attn + cross-attn · N layers · d=768</div>
  <div class="port">[B,768,h·w] → [B,T,768]</div>
  <span class="step-badge">·</span>
</div>
```

### Output head / CTC or LM head (role=embed)

```html
<div class="node" data-role="embed" data-id="head" style="left: 58%; top: 38%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
  </div>
  <div class="label">Output Head</div>
  <div class="tech">Linear → vocab · CTC / LM logits</div>
  <div class="port">[B,T,768] → [B,T,vocab]</div>
  <span class="step-badge">·</span>
</div>
```

### Loss (role=compute)

```html
<div class="node" data-role="compute" data-id="loss" style="left: 58%; top: 18%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M19 9l-5 5-4-4-3 3"/></svg>
  </div>
  <div class="label">Loss</div>
  <div class="tech" data-tech-train="CTC / CrossEntropy · reduction=mean" data-tech-eval="metric only · CER / WER">CTC / CrossEntropy · reduction=mean</div>
  <div class="port" data-port-train="logits + targets → scalar" data-port-eval="disabled (no_grad)">logits + targets → scalar</div>
  <span class="step-badge">·</span>
</div>
```

### Optimizer / backward step (role=seed)

```html
<div class="node" data-role="seed" data-id="optimizer" style="left: 40%; top: 18%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
  </div>
  <div class="label">Optimizer Step</div>
  <div class="tech" data-tech-train="loss.backward() · AdamW · lr sched" data-tech-eval="skipped (eval mode)">loss.backward() · AdamW · lr sched</div>
  <div class="port">grads → param update</div>
  <span class="step-badge">·</span>
</div>
```

### Checkpoint store (role=vector)

Local/on-prem checkpoint store; pushes promoted weights to the **HF Hub node** (the model registry) — don't draw a second registry.

```html
<div class="node" data-role="vector" data-id="ckpt" style="left: 76%; top: 18%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
  </div>
  <div class="label">Checkpoint Store</div>
  <div class="tech">state_dict · optimizer · step/epoch</div>
  <div class="port">ckpt-{step}.pt → HF Hub</div>
  <span class="step-badge">·</span>
</div>
```

### Ray Train workers (role=compute)

```html
<div class="node" data-role="compute" data-id="ray_train" style="left: 22%; top: 18%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
  </div>
  <div class="label">Ray Train</div>
  <div class="tech">TorchTrainer · DDP · N workers · GPU</div>
  <div class="port">data-parallel · all-reduce grads</div>
  <span class="step-badge">·</span>
</div>
```

---

## CI/CD — Dagger, GitHub Actions (role=seed)

Build/test/publish pipelines that produce the container images GitOps then deploys. One-shot, so `seed` (orange). Dagger and GitHub Actions are the same shape — swap the label.

### Dagger pipeline / GitHub Actions

```html
<div class="node" data-role="seed" data-id="ci" style="left: 4%; top: 4%;">
  <div class="icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  </div>
  <div class="label" data-label-dev="Dagger" data-label-prod="GitHub Actions">Dagger</div>
  <div class="tech">build · test · publish image</div>
  <div class="port">self-hosted runner · arm64</div>
  <span class="step-badge">·</span>
</div>
```

---

## Icon attribution

All icons are derived from [Feather Icons](https://feathericons.com/) (MIT license), sized to 14×14 with `stroke-width="2"`. To swap an icon: copy the SVG from feathericons.com, strip to its shape elements (`<rect>`, `<path>`, `<circle>`, `<line>`, `<polyline>`, `<polygon>`, `<ellipse>`), and wrap in `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">…</svg>`. Keep `stroke="currentColor"` — it lets the glyph inherit the role color.
