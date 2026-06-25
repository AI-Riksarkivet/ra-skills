# Hooks, components & prop catalog

All hooks must run inside `<SvelteFlow>` / `<SvelteFlowProvider>` and (except `useSvelteFlow`) expose a
reactive `.current`. See [`svelte-integration.md`](svelte-integration.md) for the `.current` rule.

## Contents
- `useSvelteFlow()` — the imperative API
- Read hooks (`useNodes`, `useEdges`, …)
- Connection / selection / lifecycle hooks
- Built-in components
- `<SvelteFlow>` prop & event catalog

## `useSvelteFlow()`

Returns helper functions (no `.current`):

```ts
const {
  screenToFlowPosition, flowToScreenPosition,
  updateNode, updateNodeData, updateEdge, deleteElements,
  getNode, getNodes, getEdge, getEdges, getInternalNode, getHandleConnections,
  fitView, fitBounds, getNodesBounds,
  setViewport, getViewport, setCenter, zoomIn, zoomOut, setZoom, getZoom,
  getIntersectingNodes, isNodeIntersecting,
  toObject,
} = useSvelteFlow();
```

(There is **no** `setNodes`/`addNodes`/`zoomTo` here — those are React Flow names; mutate via `bind:`
arrays or `updateNode`/`updateNodeData`. To re-measure handles use the separate `useUpdateNodeInternals()`
hook.)

Common uses:

- **Drop coordinates** (drag-and-drop, add-node-on-edge-drop):
  `screenToFlowPosition({ x: event.clientX, y: event.clientY })`.
- **Update data immutably:** `updateNodeData(id, { ...newData })` (pass a new object).
- **Delete:** `deleteElements({ nodes: [{ id }], edges: [{ id }] })`.
- **Framing:** `fitView(options)` / `fitBounds(rect)` / `setCenter(x, y)`.
- **Intersections:** `getIntersectingNodes(nodeOrRect)`, `isNodeIntersecting(...)`.

## Read hooks

| Hook | Returns (`.current`) | Notes |
|---|---|---|
| `useNodes()` | nodes array | reassignable |
| `useEdges()` | edges array | reassignable |
| `useViewport()` | `{ x, y, zoom }` | reassignable |
| `useConnection()` | active connection or `null` per field | colorize handles while connecting |
| `useNodeConnections({ handleType?, handleId?, id? })` | connections on a node/handle | call inside a custom node, or pass `id` |
| `useNodesData(ids)` | data of the given node id(s) | for computing flows |
| `useInternalNode(id)` | internal node (`positionAbsolute`, `handleBounds`) | advanced/custom edges |
| `useNodesInitialized()` | boolean | true once all nodes measured |
| `useStore()` | internal store fields | advanced only; prefer dedicated hooks |

```svelte
<script lang="ts">
  import { useNodeConnections, useNodesData } from '@xyflow/svelte';
  const connections = useNodeConnections({ handleType: 'target' });
  const upstream = useNodesData(connections.current.map((c) => c.source));
  $effect(() => console.log(upstream.current));
</script>
```

## Connection / selection / lifecycle hooks

- `useOnSelectionChange((sel) => { sel.nodes; sel.edges; })` — runs on every selection change.
- `useUpdateNodeInternals()` → call `updateNodeInternals(id)` after changing handles
  (see [nodes ref](nodes-handles-subflows.md)).

## Built-in components

Import from `@xyflow/svelte` and place **inside** `<SvelteFlow>`.

| Component | Purpose | Key props |
|---|---|---|
| `Background` | grid pattern | `variant` (`BackgroundVariant.Lines`/`Dots`/`Cross`), `gap`, `size`, `bgColor` |
| `Controls` | zoom / fit / lock buttons | extend with `ControlButton` (`onclick`, children) |
| `MiniMap` | overview + viewport indicator | `pannable`, `zoomable`, `nodeColor`, `nodeStrokeColor`, `nodeClassName`, `nodeStrokeWidth` |
| `Panel` | fixed overlay | `position` (`top-left`…`bottom-right`, `center-left/right`) |
| `ViewportPortal` | render in viewport coords (pans/zooms with nodes) | `target` (`front`/`back`) |

`nodeColor`/`nodeStrokeColor`/`nodeClassName` on `MiniMap` accept a `(node) => value` function.

```svelte
<SvelteFlow bind:nodes bind:edges>
  <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
  <Controls />
  <MiniMap pannable zoomable nodeColor={(n) => (n.type === 'input' ? '#6ede87' : '#999')} />
  <Panel position="top-left"><h3>My flow</h3></Panel>
</SvelteFlow>
```

Other importable components used **inside custom nodes/edges**: `Handle`, `BaseEdge`, `EdgeLabel`,
`EdgeReconnectAnchor`, `EdgeToolbar`, `NodeToolbar`, `NodeResizer`, `NodeResizeControl`.

## `<SvelteFlow>` prop & event catalog

Grouped (all optional unless noted). The full props type is exported as `SvelteFlowProps`.

**Required(ish):** `bind:nodes`, `bind:edges`.

**Viewport:** `fitView`, `fitViewOptions`, `viewport` / `initialViewport`, `minZoom`, `maxZoom`,
`snapGrid`, `onlyRenderVisibleElements`, `translateExtent`, `preventScrolling`, `attributionPosition`,
`width`/`height` (SSR).

**Nodes:** `nodeTypes`, `nodeOrigin`, `nodesDraggable`, `nodesConnectable`, `nodesFocusable`,
`nodeDragThreshold`, `nodeClickDistance`, `nodeExtent`, `elevateNodesOnSelect`.

**Edges:** `edgeTypes`, `edgesFocusable`, `elevateEdgesOnSelect`, `defaultMarkerColor`,
`defaultEdgeOptions`.

**Interaction:** `elementsSelectable`, `selectNodesOnDrag`, `panOnDrag`, `selectionOnDrag`,
`selectionMode` (`Partial`/`Full`), `panOnScroll`, `panOnScrollMode`, `zoomOnScroll`, `zoomOnPinch`,
`zoomOnDoubleClick`, `connectionMode`, `autoPanOnConnect`, `autoPanOnNodeDrag`, `zIndexMode`.

**Connection line:** `connectionLineComponent`, `connectionLineType`, `connectionLineStyle`,
`connectionRadius`.

**Keyboard:** `deleteKey`, `selectionKey`, `multiSelectionKey`, `zoomActivationKey`, `panActivationKey`,
`disableKeyboardA11y`.

**Style / class:** `colorMode` (`light`/`dark`/`system`), `colorModeSSR`, `noPanClass`, `noDragClass`,
`noWheelClass`, `proOptions` (`{ hideAttribution: true }`), `style`, `class`.

**Events** (Svelte 5 lowercase handlers):

- General: `oninit`, `onflowerror`, `ondelete`, `onbeforedelete`.
- Nodes: `onnodeclick`, `onnodedragstart`, `onnodedrag`, `onnodedragstop`, `onnodepointerenter`,
  `onnodepointermove`, `onnodepointerleave`, `onnodecontextmenu`.
- Edges: `onedgeclick`, `onedgecontextmenu`, `onedgepointerenter`, `onedgepointerleave`, `onreconnect`,
  `onreconnectstart`, `onreconnectend`, `onbeforereconnect`.
- Connection: `onconnect`, `onconnectstart`, `onconnectend`, `onbeforeconnect`, `isValidConnection`,
  `clickConnect`, `onclickconnectstart`, `onclickconnectend`.
- Pane/viewport: `onpaneclick`, `onpanecontextmenu`, `onmovestart`, `onmove`, `onmoveend`.
- Selection: `onselectionchange`, `onselectionclick`, `onselectioncontextmenu`, `onselectiondragstart`,
  `onselectiondrag`, `onselectiondragstop`, `onselectionstart`, `onselectionend`.

> Event handler names are **lowercase** (`onnodeclick`), unlike React Flow's camelCase (`onNodeClick`).
> Don't carry React naming into Svelte.
