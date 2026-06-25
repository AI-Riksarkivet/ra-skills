# Static mode — boundaries, masking, layout & export

The craft reference for the **static** template (`assets/static-template.html`): a polished dark
boxes-and-arrows topology snapshot with grouping boundaries. No steps, no modes — you hand-place
SVG boxes inside grouping containers and draw labeled arrows between them.

Read this when you've already picked **static** mode (per `SKILL.md` Step 0). For node identities
(Ray, Argo, NATS, FastAPI, SvelteKit, …) pull copy-paste snippets from
`references/ra-stack-library.md`; this file is about the *container craft* — the design system,
the four boundary primitives, the arrow-masking trick, spacing, the summary cards, and the export
toolbar internals.

> **Role colors vs. the static palette.** The six RA **node roles** (`user` mint, `orch` sky,
> `compute` magenta, `embed` amber, `vector` violet, `seed` orange — exactly these six, never a
> seventh) are the vocabulary for the **interactive** template's CSS variables. The **static**
> template uses its own *semantic* SVG palette below (cyan frontend, emerald backend, …). They are
> two skins of the same intent — section 1 maps one onto the other so a diagram reads consistently
> whichever template it came from. Both still obey the **6-distinct-fill cap**: more than six box
> styles makes the legend a colorblind nightmare.

---

## 1. The static design system

### Canvas

- **Background:** `#020617` (slate-950) on `<body>`, with a 40px grid pattern *inside* the SVG so the
  grid scales with the diagram.
- **Font:** JetBrains Mono everywhere (loaded from Google Fonts in `<head>`). Sizes: **12px** component
  name, **9px** sublabel, **8px** annotation/legend, **7px** tiny label.
- **Boxes:** rounded rects `rx="6"`, `stroke-width="1.5"`, translucent fill.

The grid + arrowhead marker live in `<defs>` and the grid is painted as the first body element so
everything draws on top of it:

```svg
<defs>
  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
  </marker>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5"/>
  </pattern>
</defs>

<!-- first thing inside the SVG, behind everything -->
<rect width="100%" height="100%" fill="url(#grid)" />
```

### Semantic palette (the static skin)

| Component type | Fill (rgba) | Stroke | RA mapping |
|---|---|---|---|
| **Frontend** (cyan) | `rgba(8, 51, 68, 0.4)` | `#22d3ee` | SvelteKit apps, turborepo `apps/`, micro-frontend host + remotes |
| **Backend** (emerald) | `rgba(6, 78, 59, 0.4)` | `#34d399` | FastAPI gateway/BFF, **Ray** head/workers/Ray Serve, Argo Workflows controller |
| **Database** (violet) | `rgba(76, 29, 149, 0.4)` | `#a78bfa` | Redis, Postgres, **NATS JetStream** stream store, HF Hub artifacts |
| **Cloud / cluster** (amber) | `rgba(120, 53, 15, 0.3)` | `#fbbf24` | components *inside* the Kubernetes cluster / cloud region |
| **Security** (rose) | `rgba(136, 19, 55, 0.4)` | `#fb7185` | **Keycloak** (OIDC/JWT), anything gated by a **NetworkPolicy** |
| **Message bus** (orange) | `rgba(251, 146, 60, 0.3)` | `#fb923c` | **NATS / Dapr** event connector bars (see §2.4) |
| **External / generic** (slate) | `rgba(30, 41, 59, 0.5)` | `#94a3b8` | users/browsers, third-party services outside the cluster |

The amber/violet/rose strokes do double duty: amber is both a *box fill* (a cloud service) **and** the
*boundary stroke* for the cluster/region container; rose is both the Keycloak box fill **and** the
NetworkPolicy boundary stroke. That overlap is intentional — it ties "this box is a security concern"
to "this dashed zone is a security boundary."

The standard box pattern (name + sublabel, vertically centered for a 50–60px box):

```svg
<rect x="X" y="Y" width="W" height="50" rx="6" fill="rgba(6, 78, 59, 0.4)" stroke="#34d399" stroke-width="1.5"/>
<text x="CENTER_X" y="Y+20" fill="white"   font-size="11" font-weight="600" text-anchor="middle">FastAPI</text>
<text x="CENTER_X" y="Y+36" fill="#94a3b8" font-size="9"  text-anchor="middle">gateway :8000</text>
```

`CENTER_X = X + W/2`. A multi-line box (e.g. a Ray cluster summary) just stacks more `<text>` lines
at `Y+20, Y+34, Y+48…` and grows `height` to ~100px.

### Legend

Build the legend out of the same fills, as 16×10 swatches with 8px labels. Keep it **outside every
boundary box** (see §4). Cap it at the fills you actually used — do not list all seven.

```svg
<text x="720" y="70" fill="white" font-size="10" font-weight="600">Legend</text>
<rect x="720" y="82"  width="16" height="10" rx="2" fill="rgba(8, 51, 68, 0.4)"  stroke="#22d3ee" stroke-width="1"/>
<text x="742" y="90"  fill="#94a3b8" font-size="8">Frontend</text>
<rect x="720" y="98"  width="16" height="10" rx="2" fill="rgba(6, 78, 59, 0.4)"  stroke="#34d399" stroke-width="1"/>
<text x="742" y="106" fill="#94a3b8" font-size="8">Backend</text>
<rect x="720" y="114" width="16" height="10" rx="2" fill="rgba(120, 53, 15, 0.3)" stroke="#fbbf24" stroke-width="1"/>
<text x="742" y="122" fill="#94a3b8" font-size="8">Cloud / cluster</text>
<rect x="720" y="130" width="16" height="10" rx="2" fill="rgba(76, 29, 149, 0.4)" stroke="#a78bfa" stroke-width="1"/>
<text x="742" y="138" fill="#94a3b8" font-size="8">Database</text>
<rect x="720" y="146" width="16" height="10" rx="2" fill="rgba(136, 19, 55, 0.4)" stroke="#fb7185" stroke-width="1"/>
<text x="742" y="154" fill="#94a3b8" font-size="8">Security</text>
<rect x="720" y="178" width="16" height="10" rx="2" fill="transparent" stroke="#fb7185" stroke-width="1" stroke-dasharray="3,3"/>
<text x="742" y="186" fill="#94a3b8" font-size="8">Security group</text>
```

---

## 2. The four boundary primitives

Flat node lists can't express "these run **inside** the cluster" or "this is a separate security
zone." These four containers do. Draw boundaries **before** the boxes they contain (so the boxes
paint on top), but their *labels* go at the top-left corner and stay clear of the inner nodes.

### 2.1 Cloud region / Kubernetes cluster — large dashed `rx=12` amber

The outermost container. Big, faint amber fill, `rx="12"`, `stroke-dasharray="8,4"`. Label top-left,
*just inside the top edge but above the first row of nodes*.

```svg
<rect x="160" y="40" width="820" height="620" rx="12"
      fill="rgba(251, 191, 36, 0.05)" stroke="#fbbf24" stroke-width="1" stroke-dasharray="8,4"/>
<text x="172" y="58" fill="#fbbf24" font-size="10" font-weight="600">Kubernetes cluster · rask (prod)</text>
```

Use one of these for "the cluster" or "the cloud region." Nest sparingly — a region containing a
cluster is fine, but a third level of dashed amber gets noisy.

### 2.2 Security group / NetworkPolicy — dashed `rx=8` rose, transparent fill

A tighter zone around the components a `NetworkPolicy` (or a security group) governs. **Transparent
fill** so it overlays cleanly inside the amber cluster, `rx="8"`, `stroke-dasharray="4,4"`.

```svg
<rect x="350" y="265" width="120" height="80" rx="8"
      fill="transparent" stroke="#fb7185" stroke-width="1" stroke-dasharray="4,4"/>
<text x="358" y="279" fill="#fb7185" font-size="8">NetworkPolicy · htr</text>
```

The transparent fill is the point: a translucent fill here would muddy the amber cluster fill
underneath. Put the boxes it wraps slightly inset (`x+10`, `y+15`).

### 2.3 Micro-frontend zone — boundary around host + remotes

Reuse a boundary rect (cyan stroke, to match the frontend palette) to draw the **composition seam**:
one zone enclosing the host app and its remotes/zones, namespaced by team. This is how you show
"`@rask/web` hosts `@rask/viewer` as a remote" without wires implying a network call.

```svg
<!-- Micro-frontend zone: host + remotes, cyan to match Frontend -->
<rect x="190" y="510" width="430" height="130" rx="8"
      fill="rgba(8, 51, 68, 0.15)" stroke="#22d3ee" stroke-width="1" stroke-dasharray="6,4"/>
<text x="202" y="528" fill="#22d3ee" font-size="9" font-weight="600">micro-frontend zone · @rask</text>

<!-- Host -->
<rect x="200" y="540" width="190" height="90" rx="6" fill="rgba(8, 51, 68, 0.4)" stroke="#22d3ee" stroke-width="1.5"/>
<text x="295" y="562" fill="white"   font-size="11" font-weight="600" text-anchor="middle">SvelteKit host</text>
<text x="295" y="578" fill="#94a3b8" font-size="9"  text-anchor="middle">@rask/web · turbo app</text>
<text x="295" y="592" fill="#94a3b8" font-size="9"  text-anchor="middle">app.riksarkivet.se</text>

<!-- Remote -->
<rect x="410" y="540" width="190" height="90" rx="6" fill="rgba(8, 51, 68, 0.4)" stroke="#22d3ee" stroke-width="1.5"/>
<text x="505" y="562" fill="white"   font-size="11" font-weight="600" text-anchor="middle">@rask/viewer</text>
<text x="505" y="578" fill="#94a3b8" font-size="9"  text-anchor="middle">remote · zone</text>
```

Model the seam explicitly: events up, props down, shared bus, URL-as-state. (See the repo's
`micro-frontends` and `turborepo` skills for the underlying patterns.)

### 2.4 Message bus / event connector bar — orange, placed in the gap

Not a box — a thin labeled **bar** that lives **in the vertical gap between two service rows** (see
§3) to mean "these talk over NATS / Dapr," not a direct call. Orange, 20px tall, `rx="4"`.

```svg
<!-- NATS JetStream connector, centered in a 40px gap -->
<rect x="X" y="GAP_Y" width="120" height="20" rx="4"
      fill="rgba(251, 146, 60, 0.3)" stroke="#fb923c" stroke-width="1"/>
<text x="X+60" y="GAP_Y+14" fill="#fb923c" font-size="7" text-anchor="middle">NATS JetStream</text>
```

Swap the label for `Dapr pub/sub` / `Redis Streams` as needed. The bar replaces a tangle of N×M
point-to-point arrows between publishers and subscribers — services arrow *to the bar*, the bar
arrows *to the subscribers*.

---

## 3. The arrow-masking trick (the load-bearing one)

Arrows are drawn **first** (right after the background grid) so, by SVG document-order painting, they
render *behind* the component boxes. **But** the box fills are translucent (`rgba(..., 0.4)`), so an
arrow passing under a box still bleeds through and looks like it pierces the box.

Fix: paint an **opaque backing rect** (`fill="#0f172a"`, the slate-900 just above the `#020617` body)
at the exact box position **before** the styled translucent rect. The opaque rect hides the arrow; the
styled rect on top keeps the semantic color. This is the **double-rect pattern** — every box that sits
on top of an arrow needs it:

```svg
<!-- 1. arrows first, behind everything -->
<line x1="130" y1="305" x2="198" y2="305" stroke="#22d3ee" stroke-width="1.5" marker-end="url(#arrowhead)"/>

<!-- 2. opaque backing rect to MASK the arrow under this box -->
<rect x="200" y="280" width="110" height="50" rx="6" fill="#0f172a"/>

<!-- 3. styled (translucent) component rect on top -->
<rect x="200" y="280" width="110" height="50" rx="6" fill="rgba(6, 78, 59, 0.4)" stroke="#34d399" stroke-width="1.5"/>
<text x="255" y="300" fill="white"   font-size="11" font-weight="600" text-anchor="middle">FastAPI</text>
<text x="255" y="316" fill="#94a3b8" font-size="9"  text-anchor="middle">:8000</text>
```

The backing rect and the styled rect must share **identical** `x/y/width/height/rx`. Boundary boxes
(cluster, NetworkPolicy) deliberately **skip** the backing rect — you *want* to see arrows cross a
dashed zone edge.

> If arrows show through a box in the rendered diagram, you forgot the `#0f172a` backing rect. This is
> the single most common static-mode defect.

---

## 4. Spacing & layout rules

- **Component height:** ~60px for a service box (50–60), 80–120px for a multi-line/cluster box.
- **Vertical gap:** ≥40px between stacked boxes. The gap is also where message-bus bars go.
- **Message buses go IN the gap**, never overlapping a box. Worked example:

  ```
  Component A: y=70,  height=60  → ends at y=130
  Gap:         y=130 → y=170     (40px) → bus bar at y=140, 20px tall
  Component B: y=170, height=60  → ends at y=230
  ```

  Wrong: bus at y=160 when B starts at y=170 (overlaps B). Right: bus at y=140, centered in the gap.

- **Legends and region labels live OUTSIDE all boundary boxes.** Compute where the lowest boundary
  ends (`y + height`), then place the legend ≥20px below it and **extend the viewBox height** to fit:

  ```
  Cluster: y=30, height=460 → ends at y=490
  Legend starts at y≥510, viewBox height ≥560
  ```

  Wrong: legend at y=470 inside a cluster that ends at y=490. Right: legend at y=510, viewBox grown.

### GO WIDE — the #1 failure mode is cramped

The upstream default viewBox is **`0 0 1000 680`** and skews small/narrow. **For RA, prefer a wider
canvas** — start around **`0 0 1400 820`** — and **spread nodes across the full width**, not the middle
third. Reasons:

- A diagram that fills the screen reads better in a workshop *and* exports to a crisper PNG/PDF.
- Wide layout is what avoids wire crossings (user far-left → orchestrator mid → datastores far-right).
- The RA house style (per `SKILL.md`) is "go wide and generous." When unsure, make it bigger.

Practical knobs when you widen:

- Set `<svg viewBox="0 0 1400 820">` and grow boundary rects to match (the cluster might become
  `width="1240"`).
- The `.diagram-container` CSS keeps `svg { width:100%; min-width:900px }` — bump `min-width` toward
  the new width (e.g. `1200px`) so it doesn't squish on smaller screens; it scrolls horizontally
  otherwise.
- Keep ≥12% **horizontal** gap between adjacent nodes (the only spacing *number* on the horizontal
  axis — there is **no** hard node-count cap; spread out instead of squeezing).
- If a system genuinely won't fit wide without crossings, split it into per-area diagrams
  ("ingest" vs "serving") rather than cramming.

---

## 5. Summary info cards & footer

Below the SVG, a **3-card grid** (`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`)
captures the key details the boxes can't — flows, SLAs, tech notes. Each card has a colored dot
(`cyan / emerald / violet / amber / rose` — matching the palette), a title, and a short bullet list:

```html
<div class="cards">
  <div class="card">
    <div class="card-header">
      <div class="card-dot emerald"></div>
      <h3>HTR pipeline</h3>
    </div>
    <ul>
      <li>• segmentation → transcription → post-processing</li>
      <li>• Ray Serve, GPU autoscaling</li>
      <li>• artifacts: page / line images</li>
    </ul>
  </div>
  <!-- two more cards (amber, violet) -->
</div>
```

The dot color classes are defined in CSS (`.card-dot.cyan/.emerald/.violet/.amber/.rose`). Three cards
is the design; add a fourth only if the grid stays balanced.

**Footer** — one minimal metadata line under the cards:

```html
<p class="footer">rask platform • Kubernetes cluster (prod) • generated 2026-06-25</p>
```

---

## 6. Export toolbar internals (shared with the interactive template)

Both templates ship the **same** export toolbar — a collapsed `⋯` toggle (top-right of the header)
that expands to **📋 Copy / 🖼️ PNG / 📄 PDF**. The exact same `copyAsImage` / `downloadPNG` /
`downloadPDF` functions and the same two CDN scripts are wired into `assets/template.html`
(interactive) too; keep them byte-for-byte identical across both.

### Pinned, SRI-hashed dependencies (in `<head>`)

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
        integrity="sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H"
        crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"
        integrity="sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/"
        crossorigin="anonymous"></script>
```

`html2canvas@1.4.1` and `jspdf@2.5.2` are **pinned** and carry **Subresource Integrity** hashes so a
compromised CDN can't inject altered code. **Do not edit the hashes**; if you bump a version, recompute
the SRI hash fresh.

### How capture works

All three buttons share one capture path: grab `#report-container`'s `getBoundingClientRect()`, add
**32px padding** on every side, and call `html2canvas(document.body, { … })` with an explicit
`x / y / width / height` window plus `ignoreElements` that **excludes the `.toolbar`** (so the export
button doesn't appear in its own screenshot). Background is forced to `#020617` and `scale: 2` for
high-DPI:

```js
const el = document.getElementById('report-container');
const r = el.getBoundingClientRect();
const pad = 32;
const canvas = await html2canvas(document.body, {
  backgroundColor: '#020617', scale: 2, useCORS: true,
  ignoreElements: (e) => e.classList && e.classList.contains('toolbar'),
  x: r.left + window.scrollX - pad, y: r.top + window.scrollY - pad,
  width: r.width + pad * 2, height: r.height + pad * 2,
});
```

- **Copy** → `canvas.toBlob` → `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
- **PNG** → `canvas.toDataURL('image/png')` on an `<a download>` click.
- **PDF** → same dataURL fed to `new jsPDF({ orientation, unit:'px', format:[w,h], hotfixes:['px_scaling'] })`
  then `pdf.addImage(...)`. Orientation auto-picks landscape/portrait from the canvas aspect ratio.

The `@media print { .toolbar { display:none !important } }` rule keeps the toolbar out of browser-print
output too, and `#report-container` on the outer `.container` div is what defines the capture region —
keep that id.

### Caveats (tell the user)

- **Clipboard needs a user gesture + secure context** (https / `file://` / localhost). It won't work
  from an `http://` non-localhost origin.
- **Offline, the buttons no-op** — the CDN scripts are unreachable so `html2canvas` / `jsPDF` are
  undefined and the handlers fail silently — **but the diagram itself still renders** (the SVG is
  inline; only export depends on the CDN).
- **PDF is a rasterized PNG**, not selectable text — it's the PNG embedded one-to-one in a one-page
  PDF, dark theme preserved (no browser print dialog).
- For higher-res output, bump `scale: 2` → `3` or `4`.
- Stick to plain `<svg>` shapes + `<text>`; html2canvas renders `<foreignObject>` inconsistently.
- (Interactive only) export captures the **current** step/mode/theme — set them first, then export.
