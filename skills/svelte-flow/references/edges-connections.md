# Edges & connections

## Contents
- Built-in edge types
- Edge labels & markers (no custom component)
- Custom edges + `EdgeProps`
- Path utils (and custom SVG paths)
- `EdgeLabel` (interactive labels)
- Registering `edgeTypes`
- Reconnectable edges (`EdgeReconnectAnchor`)
- Connection events & validation
- `addEdge` and graph utils
- Delete-middle-node pattern

## Built-in edge types

Five built-ins: `default` (bezier), `straight`, `step`, `smoothstep`, `simplebezier`. Set per edge with
`type`. Add a `label` for a floating mid-edge label without writing a custom edge:

```js
let edges = $state.raw([
  { id: 'n1-n2', source: 'n1', target: 'n2', type: 'smoothstep', label: 'connects with' },
]);
```

Apply defaults to every new edge via the `defaultEdgeOptions` prop:

```svelte
<SvelteFlow bind:nodes bind:edges defaultEdgeOptions={{ animated: true, type: 'smoothstep' }} />
```

## Markers

Add arrowheads with `markerStart` / `markerEnd` using `MarkerType` (`Arrow` or `ArrowClosed`):

```js
import { MarkerType } from '@xyflow/svelte';
{ id: 'e1', source: 'a', target: 'b', markerEnd: { type: MarkerType.ArrowClosed } }
```

## Custom edges

A custom edge is a Svelte component receiving `EdgeProps`. Render the path with `<BaseEdge>` and a path
util. `BaseEdge` handles the invisible interaction helper + label for you.

```svelte
<!-- StraightEdge.svelte -->
<script lang="ts">
  import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/svelte';
  let { id, sourceX, sourceY, targetX, targetY }: EdgeProps = $props();
  let [edgePath] = $derived(getStraightPath({ sourceX, sourceY, targetX, targetY }));
</script>

<BaseEdge {id} path={edgePath} />
```

### `EdgeProps` (key fields)

`id`, `source`, `target`, `sourceX`, `sourceY`, `targetX`, `targetY`, `sourcePosition`, `targetPosition`,
`data`, `selected`, `animated`, `label`, `labelStyle`, `markerStart`, `markerEnd`, `interactionWidth`,
`sourceHandleId`, `targetHandleId`, `style`.

Always feed `sourceX/Y/targetX/Y` (and `sourcePosition`/`targetPosition` for non-straight paths) into the
path util — omitting positions makes edges leave handles at wrong angles.

## Path utils

Each returns a **tuple** `[path, labelX, labelY, offsetX, offsetY]`:

- `getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })`
- `getSmoothStepPath({ … , borderRadius })` — `borderRadius: 0` gives a hard step edge
- `getStraightPath({ sourceX, sourceY, targetX, targetY })`

```js
const [path, labelX, labelY] = getBezierPath({
  sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
});
```

### Custom SVG paths

For shapes the utils don't cover (sinusoidal, custom routing), build the SVG path string yourself and pass
it to `<BaseEdge path={...} />`. Start at the source with `M sourceX sourceY`, use `L`/`Q`/`C` commands,
end at `targetX targetY`. (The [svg-path-editor](https://yqnn.github.io/svg-path-editor/) helps.)

## `EdgeLabel` (interactive labels)

For labels with controls (buttons, inputs), use `<EdgeLabel>` — a portal that escapes the SVG so you can
render real HTML. It inherits the edge's z-index and selects the edge on click.

```svelte
<!-- ButtonEdge.svelte -->
<script lang="ts">
  import { BaseEdge, EdgeLabel, getBezierPath, useSvelteFlow, type EdgeProps } from '@xyflow/svelte';
  let { id, sourceX, sourceY, targetX, targetY }: EdgeProps = $props();
  let [edgePath, labelX, labelY] = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY }));
  const { deleteElements } = useSvelteFlow();
</script>

<BaseEdge {id} path={edgePath} />
<EdgeLabel x={labelX} y={labelY}>
  <button class="nodrag nopan" onclick={() => deleteElements({ edges: [{ id }] })}>×</button>
</EdgeLabel>
```

Add `nodrag nopan` to interactive label elements so clicks don't pan the canvas. (`<EdgeLabel>` replaces
0.x's `<EdgeLabelRenderer>`.)

## Registering `edgeTypes`

Same rules as `nodeTypes`: define once at module scope, keys match the edge `type`.

```svelte
<script lang="ts">
  import { SvelteFlow, type EdgeTypes } from '@xyflow/svelte';
  import ButtonEdge from './ButtonEdge.svelte';
  const edgeTypes: EdgeTypes = { button: ButtonEdge };
</script>
<SvelteFlow bind:nodes bind:edges {edgeTypes} />
```

## Reconnectable edges (`EdgeReconnectAnchor`)

Make a custom edge reconnectable by rendering `<EdgeReconnectAnchor>` (behaves like a handle: drag it to
restart the connection from the opposite end):

```svelte
<script lang="ts">
  import { BaseEdge, EdgeReconnectAnchor, getBezierPath, type EdgeProps } from '@xyflow/svelte';
  let { sourceX, sourceY, targetX, targetY, selected, ...props }: EdgeProps = $props();
  const [edgePath] = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY }));
  let reconnecting = $state(false);
</script>

{#if !reconnecting}<BaseEdge path={edgePath} {...props} />{/if}
{#if selected}
  <EdgeReconnectAnchor bind:reconnecting type="source" position={{ x: sourceX, y: sourceY }} />
  <EdgeReconnectAnchor bind:reconnecting type="target" position={{ x: targetX, y: targetY }} />
{/if}
```

Lifecycle callbacks: `onreconnect`, `onreconnectstart`, `onreconnectend`, and `onbeforereconnect`
(return a modified edge, or `false`/`null` to abort/restore).

## Connection events & validation

`<SvelteFlow>` connection props/events:

- `onconnect(connection)` — a new connection was made. Usually `edges = addEdge(connection, edges)`.
- `onconnectstart` / `onconnectend` — drag start/finish (used for "add node on edge drop").
- `onbeforeconnect(connection)` — return a modified connection/edge, or `false`/`null` to block (replaces
  0.x's `onEdgeCreate`; e.g. add a custom edge `id`).
- `isValidConnection(connection)` — return `false` to forbid a connection (also a `<Handle>` prop).
- `connectionMode` — `ConnectionMode.Strict` (default; source↔target only) or `ConnectionMode.Loose`.
- Click-to-connect: `clickConnect`, `onclickconnectstart`, `onclickconnectend`.
- Connection line appearance: `connectionLineType`, `connectionLineComponent` (custom component — replaces
  0.x's `slot="connectionLine"`), `connectionLineStyle`, `connectionRadius`.

## `addEdge` and graph utils

```js
import {
  addEdge, getConnectedEdges, getIncomers, getOutgoers, getNodesBounds, getViewportForBounds,
  isEdge, isNode,
} from '@xyflow/svelte';
```

- `addEdge(edgeOrConnection, edges)` → new edges array; refuses duplicates and invalid edges.
- `getConnectedEdges(nodes, edges)` → edges touching any of `nodes`.
- `getIncomers(node, nodes, edges)` / `getOutgoers(node, nodes, edges)` → connected source/target nodes.
- `getNodesBounds(nodes)` → bounding box; pair with `getViewportForBounds` for manual fit.
- `isNode` / `isEdge` → type guards.

## Delete-middle-node pattern

To keep a chain connected when deleting a middle node (`a→b→c` ⇒ `a→c`), intercept with `onbeforedelete`,
rebuild edges from incomers→outgoers, and return `true`:

```js
function onbeforedelete({ nodes: toDelete }) {
  let next = edges;
  for (const node of toDelete) {
    const incomers = getIncomers(node, nodes, edges);
    const outgoers = getOutgoers(node, nodes, edges);
    const connected = getConnectedEdges([node], edges);
    next = next.filter((e) => !connected.includes(e));
    next = next.concat(
      incomers.flatMap(({ id: source }) =>
        outgoers.map(({ id: target }) => ({ id: `${source}-${target}`, source, target }))),
    );
  }
  edges = next;
  return true;            // allow the deletion to proceed
}
```

Other deletion hooks: `ondelete` (after) and `onbeforedelete` (async; return `false` to block or a
modified `{ nodes, edges }` set).
