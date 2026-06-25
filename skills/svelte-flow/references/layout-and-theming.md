# Layouting & theming

## Contents
- Auto-layout: the general pattern
- Dagre (hierarchical, the default choice)
- d3-hierarchy (single-root trees)
- d3-force (force-directed)
- elkjs (most configurable, async)
- Edge routing
- Theming: default vs base styles
- CSS variables
- Class overrides & dark mode
- Tailwind

## Auto-layout: the general pattern

Svelte Flow does **not** lay out nodes for you — positions come from your data or a layout library. The
recipe is always the same:

1. Give the library each node's **dimensions** (Svelte Flow exposes them as `node.measured.width/height`
   once measured; before that use the node's `width`/`height` or sensible defaults).
2. Run the layout to get new `{ x, y }` per node.
3. **Reassign `nodes`** with new objects (immutability — see
   [svelte-integration.md](svelte-integration.md)).

```js
const { nodes: laid, edges: laidEdges } = getLayoutedElements(nodes, edges, 'TB');
nodes = laid;
edges = laidEdges;
```

Pick by need: **dagre** (drop-in trees/DAGs) · **d3-hierarchy** (single-root trees, tree-maps) ·
**d3-force** (organic/iterative) · **elkjs** (full control, async). Install with `bun add` (e.g.
`bun add @dagrejs/dagre`).

## Dagre (recommended default)

Hierarchical directed-graph layout, minimal config. See [`assets/dagre-layout.ts`](../assets/dagre-layout.ts)
for the ready helper. Core idea:

```ts
import dagre from '@dagrejs/dagre';
import { Position, type Node, type Edge } from '@xyflow/svelte';

export function getLayoutedElements(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction });
  const isH = direction === 'LR';
  for (const n of nodes) g.setNode(n.id, { width: n.measured?.width ?? 172, height: n.measured?.height ?? 36 });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const { x, y, width, height } = g.node(n.id);
      return {
        ...n,
        sourcePosition: isH ? Position.Right : Position.Bottom,
        targetPosition: isH ? Position.Left : Position.Top,
        position: { x: x - width / 2, y: y - height / 2 },  // dagre centers; SF uses top-left
      };
    }),
    edges,
  };
}
```

## d3-hierarchy

For graphs that are a **single-root tree**. Note: d3-hierarchy assigns the **same width/height to all
nodes**, so it's a poor fit for many different node sizes. Repo: `d3-hierarchy`.

## d3-force

Physics-based, **iterative** — the simulation runs over multiple ticks, so you update node positions on
each tick (and can re-run on interaction). Use a rectangular collision force (d3-force's built-in
collision assumes circles). For large graphs, gate the simulation on/off rather than running it forever.
Repo: `d3-force`.

## elkjs

Most configurable, but a Java→JS port with a steep API and **asynchronous** layout (returns a promise) —
`await elk.layout(graph)`, then update Svelte state. Keep the
[ELK reference](https://eclipse.dev/elk/reference.html) handy. Repo: `elkjs`.

## Edge routing

The layout libs position nodes; edges fall where they may. For orthogonal/custom edge routing, implement
a [custom edge](edges-connections.md) that builds its own SVG path. There's no built-in router.

## Theming: default vs base styles

```js
import '@xyflow/svelte/dist/style.css';   // full default look (use this normally)
// or
import '@xyflow/svelte/dist/base.css';    // only the structural styles SF needs to function
```

`base.css` is the **minimum required** for the library to work. If you fully replace `style.css` with your
own theme, you must still import `base.css`.

## CSS variables

Tweak the look without replacing styles by overriding `--xy-*` variables under `.svelte-flow`:

```css
.svelte-flow {
  --xy-node-background-color-default: #ff5050;
  --xy-edge-stroke-default: #b1b1b7;
  --xy-handle-background-color-default: #1a192b;
}
```

(These defaults are defined under both `.svelte-flow` and `:root`.)

## Class overrides & dark mode

Set color mode with the `colorMode` prop (`'light'`/`'dark'`/`'system'`). It adds a class to the root so
you can target either mode:

```css
.dark  .svelte-flow__node { background: #777; color: white; }
.light .svelte-flow__node { background: white; color: #111; }
```

Overridable classes include `.svelte-flow__node`, `.svelte-flow__edge`, `.svelte-flow__handle`,
`.svelte-flow__controls`, `.svelte-flow__minimap`. Don't override internal layout classes you find in the
source — some are functional.

Custom nodes/edges are Svelte components, so prefer **scoped `<style>`** in them for isolated styling.

## Tailwind

Import the stylesheet into Tailwind's **base layer** so utilities win the cascade:

```css
/* app.css */
@import '@xyflow/svelte/dist/style.css' layer(base);
@import 'tailwindcss';
```

Then style nodes/handles with utility classes directly (`class="px-4 py-2 rounded-md bg-background …"`,
`<Handle class="w-16 bg-teal-500 …" />`).
