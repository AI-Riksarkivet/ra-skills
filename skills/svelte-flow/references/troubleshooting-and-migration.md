# Troubleshooting & v0 → v1 migration

## Contents
- "Edges aren't showing" checklist
- Common warnings & errors (with fixes)
- Canvas + `<canvas>` mouse coordinate fix
- Migrating Svelte Flow 0.x → 1.0

## "Edges aren't showing" checklist

Work top to bottom:

1. **Stylesheet imported?** `import '@xyflow/svelte/dist/style.css';` (or `base.css`). Most common cause.
2. **Custom node has a `<Handle>`?** No handle ⇒ no edge can attach.
3. **Styling lib overriding edges?** Some setups override `.svelte-flow__edges` SVG with
   `overflow: hidden`, hiding edges.
4. **Async/added handles measured?** After async layout or handle changes, call `updateNodeInternals(id)`
   from `useUpdateNodeInternals()`.
5. **Edge has `source` + `target`?** Both required (plus `id`).

If edges render but look wrong: don't hide handles with `display:none` (use `opacity:0`/`visibility:hidden`);
give same-side multi-handles unique `id`s; pass `sourceX/Y/targetX/Y` **and** `sourcePosition`/
`targetPosition` into the path util.

## Common warnings & errors

| Message | Cause | Fix |
|---|---|---|
| **Could not find a Svelte Flow context** | hook called outside the flow | call it in a child of `<SvelteFlow>`, or wrap in `<SvelteFlowProvider>` ([svelte-integration](svelte-integration.md)) |
| **It looks like you have created a new nodeTypes/edgeTypes object** | object defined inline / recreated each render | define `nodeTypes`/`edgeTypes` once at module scope (or `$derived`) |
| **Node/Edge type not found. Using fallback "default"** | `type` string ≠ a `nodeTypes`/`edgeTypes` key | match keys to `type` exactly (case-sensitive); pass the `*Types` prop |
| **The parent container needs a width and a height** | wrapper has no height | size the wrapping `<div>` (e.g. `height: 100vh` or inherited) |
| **Only child nodes can use a parent extent** | `extent: 'parent'` without `parentId` | add `parentId`, or remove `extent` |
| **Can't create edge. An edge needs a source and a target** | edge missing `source`/`target` | provide both (+ `id`) |
| **Couldn't create edge for source/target handle id** | wrong/missing handle `id`, or internals stale | give handles unique `id`s; call `updateNodeInternals` after changing them |
| **Marker type doesn't exist** | unknown marker | use `MarkerType.Arrow` / `MarkerType.ArrowClosed` |
| **Handle: No node id found** | `<Handle>` used outside a custom node | only render `<Handle>` inside a node component |
| **It seems that you haven't loaded the styles** | stylesheet missing | import `@xyflow/svelte/dist/style.css` or `base.css` |
| **useNodeConnections: No node ID found** | called outside a custom node without `id` | call inside a node, or pass `{ id }` |
| **Node/Edge … does not exist, it may have been removed** | accessing an element already deleted (e.g. in a click handler) | guard for existence before use |

## `<canvas>` inside a node: mouse coordinates

Svelte Flow scales nodes with CSS transforms, but the DOM still reports unscaled sizes. If a `<canvas>` in
a custom node gets wrong pointer coords, scale your computed relative position by `1 / zoom`
(`getZoom()` from `useSvelteFlow`).

## Migrating Svelte Flow 0.x → 1.0

Svelte Flow 1.0 is rebuilt on Svelte 5. The breaking changes:

| 0.x | 1.0 |
|---|---|
| `const nodes = writable([...])` | `let nodes = $state.raw([...])` |
| `<SvelteFlow {nodes} {edges} />` | `<SvelteFlow bind:nodes bind:edges />` |
| single-property updates allowed | **immutable**: new object + reassign array (or `updateNode`/`updateNodeData`) |
| `export let data` / `$$Props = NodeProps` | `let { data }: NodeProps = $props()` |
| hooks return writables; `$nodes` / `.subscribe` | hooks return `.current` (reassignable for nodes/edges/viewport) |
| `const viewport = writable({...})` + `{viewport}` | `let viewport = $state({...})` + `bind:viewport` |
| `<ConnectionLine slot="connectionLine" />` | `connectionLineComponent={ConnectionLine}` prop |
| `onEdgeCreate={...}` | `onbeforeconnect={...}` |
| `<EdgeLabelRenderer>` | `<EdgeLabel x={labelX} y={labelY}>` (handles selection + positioning) |

New in 1.0 worth knowing: `<EdgeReconnectAnchor>` (reconnectable edges), keyboard navigation / a11y
(`disableKeyboardA11y` to opt out), click-to-connect, `colorModeSSR`, `elevateNodesOnSelect` /
`elevateEdgesOnSelect`, configurable `noDragClass`/`noWheelClass`/`noPanClass`, `onselectionchange` /
`useOnSelectionChange`, and an improved `fitView` for dynamically added nodes.

> The 0.x docs live at `legacy.svelteflow.dev`. If you see `writable`, `$$Props`, `slot=`, or
> `$store` syntax in Svelte Flow code, it's 0.x — migrate it.
