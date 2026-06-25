---
name: svelte-flow
version: 1.0.0
description: "Svelte Flow (@xyflow/svelte) — node-based UI / flow-graph / diagram editors for the rask SvelteKit frontend, biased to SvelteKit 2 + Svelte 5 (runes). Covers the <SvelteFlow /> component, nodes & edges, handles, custom nodes and custom edges, the built-in Background / Controls / MiniMap / Panel / ViewportPortal components, hooks (useSvelteFlow, useNodes, useEdges, useNodeConnections, useNodesData, useUpdateNodeInternals, useStore, …), edge-path utils (getBezierPath / getSmoothStepPath / getStraightPath), graph utils (addEdge, getConnectedEdges, getIncomers/getOutgoers), connection validation, reconnectable edges, sub-flows, theming, SSR, TypeScript generics, and external layouting (dagre / d3-hierarchy / d3-force / elkjs). Encodes the Svelte 5 reality that trips Claude up: nodes/edges are $state.raw and immutable, you bind:nodes / bind:edges, hooks return .current and must run inside the flow context, and the stylesheet must be imported. Ships copy-paste SvelteKit templates (a golden-path Flow.svelte, a custom node, a custom edge, a flow store module, a dagre layout helper) plus a reference per topic. Use when building, modifying, or reviewing a node editor / graph / workflow / pipeline / mind-map / diagram UI in the SvelteKit app, or when the user mentions Svelte Flow, @xyflow/svelte, xyflow, nodes-and-edges, handles, or a drag-to-connect canvas. NOT for static diagrams (use Mermaid / the architecture-diagram skill), charting (use LayerChart), or React Flow (@xyflow/react — different package)."
---

# Svelte Flow (@xyflow/svelte) for SvelteKit

Interactive node-based UIs — flow editors, graph/diagram canvases, workflow & pipeline builders — for
the rask **SvelteKit 2 + Svelte 5** frontend. This skill targets **Svelte Flow 1.0** (the Svelte 5
rewrite). The library API is small; the hard part is Svelte 5 reactivity — and that's exactly where
generated code goes wrong.

> Package: `@xyflow/svelte` (install with `bun add @xyflow/svelte`). This is **not** React Flow
> (`@xyflow/react`) — the APIs look similar but the components, props (lowercase events), and
> reactivity model differ. Never copy React Flow code into a Svelte file.

## When to use

- Building or editing a **node-and-edge canvas**: flow/workflow editors, pipeline/DAG builders,
  mind-maps, org charts, state-machine or RAG/agent graph visualizers, whiteboards.
- Anything needing **drag-to-connect handles**, custom node/edge components, a minimap, pan/zoom
  viewport, sub-flows (grouping), or programmatic graph manipulation.

**Not for:** static, non-interactive diagrams that belong inline (use Mermaid, or the
[`architecture-diagram`](../architecture-diagram/SKILL.md) skill) · data charts (use LayerChart) ·
React (`@xyflow/react`).

## The five rules (read before writing any Svelte Flow)

These prevent ~every common bug. Details + the error each one causes are in
[`references/troubleshooting-and-migration.md`](references/troubleshooting-and-migration.md).

1. **State is `$state.raw` and immutable.** Declare `let nodes = $state.raw([...])` — never `$state(...)`
   (deep reactivity on every node/handle tanks performance). To change a node, **create a new object
   and reassign the array** (`nodes = nodes.map(...)`) or use `updateNode` / `updateNodeData`. Mutating
   `nodes[0].position.x = …` in place does **nothing**.
2. **Bind, don't pass.** `<SvelteFlow bind:nodes bind:edges />`. Plain `{nodes}` won't write
   drag/select/connect changes back to your arrays. State in another module → use
   [function bindings](references/svelte-integration.md).
3. **Import the stylesheet, once.** `import '@xyflow/svelte/dist/style.css';` in your entry/layout.
   Missing it = invisible edges, broken handles, and a warning. (Tailwind: import it `layer(base)`.)
4. **The wrapper needs width *and* height.** `<SvelteFlow />` fills its parent; a zero-height `<div>`
   renders an empty canvas. Wrap it in an element with explicit or inherited dimensions.
5. **Hooks run inside the flow and return `.current`.** `useNodes()`, `useSvelteFlow()`, etc. only work
   in a component rendered inside `<SvelteFlow>` or `<SvelteFlowProvider>`. Read reactive values via
   `.current`. Define `nodeTypes` / `edgeTypes` **once at module scope** (not inline) and make each key
   match the node/edge `type` string exactly.

## Quick start

```svelte
<script lang="ts">
  import { SvelteFlow, Background, Controls, MiniMap, BackgroundVariant } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import type { Node, Edge } from '@xyflow/svelte';

  let nodes = $state.raw<Node[]>([
    { id: 'n1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Start' } },
    { id: 'n2', position: { x: 0, y: 120 }, data: { label: 'Next' } },
  ]);
  let edges = $state.raw<Edge[]>([
    { id: 'n1-n2', source: 'n1', target: 'n2' },
  ]);
</script>

<div style:width="100%" style:height="100vh">
  <SvelteFlow bind:nodes bind:edges fitView colorMode="system">
    <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
    <Controls />
    <MiniMap />
  </SvelteFlow>
</div>
```

A node needs `id` + `position` + `data`; an edge needs `id` + `source` + `target`. `fitView` frames the
graph on load. Scaffold the fuller version from [`assets/Flow.svelte`](assets/Flow.svelte).

## Golden path — pick the approach

| You need… | Use | Where |
|---|---|---|
| A starting flow component | golden-path template | [`assets/Flow.svelte`](assets/Flow.svelte) |
| Custom node content (inputs, charts, multiple handles) | a Svelte component + `nodeTypes` | [`assets/TextUpdaterNode.svelte`](assets/TextUpdaterNode.svelte), [nodes ref](references/nodes-handles-subflows.md) |
| A custom edge (label, delete button, custom path) | `BaseEdge` + a path util + `EdgeLabel` | [`assets/ButtonEdge.svelte`](assets/ButtonEdge.svelte), [edges ref](references/edges-connections.md) |
| Read/mutate the graph imperatively | `useSvelteFlow()` + hooks (`.current`) | [hooks ref](references/hooks-components-api.md) |
| Graph/edge state in a shared module | `flow.svelte.ts` + function bindings | [`assets/flow.svelte.ts`](assets/flow.svelte.ts) |
| Auto-arrange nodes | external lib (dagre/elk) → reassign `nodes` | [`assets/dagre-layout.ts`](assets/dagre-layout.ts), [layout ref](references/layout-and-theming.md) |
| Persist/measure handles on the server | explicit `width`/`height`/`handles` | [SSR in svelte-integration ref](references/svelte-integration.md) |

## Custom nodes & edges (the 80%)

Custom nodes/edges are plain Svelte components that receive typed props. Register them once and refer to
them by the `type` key.

```svelte
<!-- TextUpdaterNode.svelte — a custom node -->
<script lang="ts">
  import { Handle, Position, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  let { id, data }: NodeProps = $props();
  const { updateNodeData } = useSvelteFlow();
</script>

<div class="node">
  <input class="nodrag" value={data.text ?? ''}
    oninput={(e) => updateNodeData(id, { text: e.currentTarget.value })} />
  <Handle type="target" position={Position.Left} />
  <Handle type="source" position={Position.Right} />
</div>
```

```svelte
<!-- App: register once at module scope, keys === node.type -->
<script lang="ts">
  import { SvelteFlow, type NodeTypes } from '@xyflow/svelte';
  import TextUpdaterNode from './TextUpdaterNode.svelte';
  const nodeTypes: NodeTypes = { textUpdater: TextUpdaterNode };
  // node: { id, type: 'textUpdater', position, data: { text: '' } }
</script>
<SvelteFlow bind:nodes bind:edges {nodeTypes} fitView />
```

Custom nodes have **no default styles** — style them yourself. Add `nodrag` to interactive elements
(inputs/buttons), `nowheel` to scroll containers, `nopan` to fixed overlays. After adding/removing
handles at runtime, call `useUpdateNodeInternals()`. Full patterns:
[`references/nodes-handles-subflows.md`](references/nodes-handles-subflows.md) and
[`references/edges-connections.md`](references/edges-connections.md).

## Workflow when invoked

1. **Confirm the stack** — Svelte 5 runes + SvelteKit 2 (`package.json`, `svelte.config.js`). Ensure
   `@xyflow/svelte` is installed (`bun add @xyflow/svelte`) and the stylesheet is imported once.
2. **Start from a template** in `assets/` rather than from scratch — they already encode the five rules.
3. **Read the topic reference** you need (table below) before using any prop/hook/util — don't guess
   API names from React Flow or memory.
4. **Check the five rules** against the result: `$state.raw` + immutable updates? `bind:`? styles
   imported? wrapper sized? hooks inside context using `.current`, `nodeTypes` at module scope?
5. **Verify every `.svelte` / `.svelte.ts` file** with the Svelte MCP `svelte-autofixer` before handing
   back — mandatory for any Svelte code this skill produces.

## References

| File | Read when |
|---|---|
| [`references/svelte-integration.md`](references/svelte-integration.md) | **Start here.** `$state.raw` + immutable updates, `bind:` / function bindings, hooks-return-`.current`, provider/context rules, SSR (width/height/handles), Svelte `transition:` with `\|global`, TypeScript generics (Node/Edge unions, `NodeProps`/`EdgeProps`, `BuiltInNode`/`BuiltInEdge`, type guards). |
| [`references/nodes-handles-subflows.md`](references/nodes-handles-subflows.md) | Custom nodes, `NodeProps`, `nodeTypes`, handles (multiple/ids/custom/`Loose`/dynamic + `useUpdateNodeInternals`), `nodrag`/`nopan`/`nowheel`, `updateNodeData`, `NodeResizer`/`NodeToolbar`, sub-flows (`parentId`, `extent:'parent'`). |
| [`references/edges-connections.md`](references/edges-connections.md) | Custom edges, `EdgeProps`, `edgeTypes`, path utils + custom SVG paths, `BaseEdge`/`EdgeLabel`, markers, reconnectable edges (`EdgeReconnectAnchor`), connection events & validation (`isValidConnection`, `onbeforeconnect`, `ConnectionMode`), `addEdge`, graph utils, delete-middle-node. |
| [`references/hooks-components-api.md`](references/hooks-components-api.md) | Every hook + `useSvelteFlow` methods, the built-in components (`Background`/`Controls`/`MiniMap`/`Panel`/`ViewportPortal`), and the grouped `<SvelteFlow>` prop & event catalog. |
| [`references/layout-and-theming.md`](references/layout-and-theming.md) | Auto-layout with dagre / d3-hierarchy / d3-force / elkjs (measure → compute → reassign), edge routing, theming (CSS variables, class overrides, dark mode, Tailwind `layer(base)`). |
| [`references/troubleshooting-and-migration.md`](references/troubleshooting-and-migration.md) | Every common warning/error + fix, "edges not showing" checklist, and the v0 → v1 migration map (`writable`→`$state.raw`, `bind:`, `$props()`, hooks `.current`, `EdgeLabelRenderer`→`EdgeLabel`, `onEdgeCreate`→`onbeforeconnect`). |

## Templates (`assets/`)

| File | What it is |
|---|---|
| [`assets/Flow.svelte`](assets/Flow.svelte) | Golden-path flow: styles imported, `$state.raw` + `bind:`, Background/Controls/MiniMap, `nodeTypes`/`edgeTypes` wired, sized wrapper, `onconnect` via `addEdge`. |
| [`assets/TextUpdaterNode.svelte`](assets/TextUpdaterNode.svelte) | Custom node: `Handle`s + `updateNodeData` + `nodrag`, with scoped styles. |
| [`assets/ButtonEdge.svelte`](assets/ButtonEdge.svelte) | Custom edge: `getBezierPath` + `BaseEdge` + `EdgeLabel` with a delete button (`deleteElements`). |
| [`assets/flow.svelte.ts`](assets/flow.svelte.ts) | `$state.raw` graph store in a module + getters/setters for function bindings + immutable `addNode`/`updateNodeData` helpers. |
| [`assets/dagre-layout.ts`](assets/dagre-layout.ts) | `getLayoutedElements(nodes, edges, direction)` — dagre helper returning new immutable arrays. |
