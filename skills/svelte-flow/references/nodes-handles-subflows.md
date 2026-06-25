# Nodes, handles & sub-flows

## Contents
- Custom nodes
- `NodeProps`
- Registering `nodeTypes`
- Handles (the connection points)
- Multiple handles & handle ids
- Custom & typeless handles
- Dynamic handles → `useUpdateNodeInternals`
- Utility classes: `nodrag` / `nopan` / `nowheel`
- `NodeResizer` & `NodeToolbar`
- Sub-flows (grouping with `parentId`)

## Custom nodes

A custom node is a Svelte component. Svelte Flow wraps it to add drag/select/connect and injects props.
Custom nodes have **no default styling** — you style them.

```svelte
<!-- TextUpdaterNode.svelte -->
<script lang="ts">
  import { Handle, Position, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  let { id, data }: NodeProps = $props();
  const { updateNodeData } = useSvelteFlow();
</script>

<div class="text-updater">
  <label for={`t-${id}`}>Text</label>
  <input
    id={`t-${id}`}
    class="nodrag"
    value={data.text ?? ''}
    oninput={(e) => updateNodeData(id, { text: e.currentTarget.value })}
  />
  <Handle type="target" position={Position.Left} />
  <Handle type="source" position={Position.Right} />
</div>

<style>
  .text-updater { padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white; }
</style>
```

## `NodeProps`

The props injected into a custom node (all available — destructure what you need):

`id`, `data`, `type`, `selected`, `dragging`, `draggable`, `selectable`, `deletable`, `dragHandle`,
`width`, `height`, `parentId`, `zIndex`, `positionAbsoluteX`, `positionAbsoluteY`,
`sourcePosition`, `targetPosition`, `isConnectable`.

Use `selected` to render selection UI. `positionAbsoluteX/Y` give the node's absolute canvas position
(useful inside sub-flows).

## Registering `nodeTypes`

Map a `type` string to a component. **Create the object once** at module scope (or `$derived`) — never
inline, or Svelte Flow warns and re-renders every frame. Keys must match the node `type` **exactly**
(case-sensitive).

```svelte
<script lang="ts">
  import { SvelteFlow, type NodeTypes } from '@xyflow/svelte';
  import TextUpdaterNode from './TextUpdaterNode.svelte';
  const nodeTypes: NodeTypes = { textUpdater: TextUpdaterNode };

  let nodes = $state.raw([
    { id: '1', type: 'textUpdater', position: { x: 0, y: 0 }, data: { text: '' } },
  ]);
</script>

<SvelteFlow bind:nodes bind:edges {nodeTypes} fitView />
```

If `type` doesn't match a key you get "Node type not found. Using fallback type 'default'."

## Handles

`<Handle />` defines a connection point. Built-in nodes have one `source` + one `target`; custom nodes
have **none until you add them** — without a handle a node can't be connected.

```svelte
<Handle type="source" position={Position.Right} />
<Handle type="target" position={Position.Left} />
```

`position` is a `Position` enum: `Left` / `Top` / `Right` / `Bottom`. A handle is a `div`; style it with
CSS or the `style`/`class` prop. Key props: `type`, `position`, `id`, `isConnectable`,
`isValidConnection`.

**Hiding handles:** use `visibility: hidden` or `opacity: 0` — **never `display: none`** (Svelte Flow
must measure the handle; `display:none` reports 0×0 and breaks edges).

## Multiple handles & handle ids

Multiple handles of the same `type` on one node **must** have unique `id`s. Edges then target a specific
handle via `sourceHandle` / `targetHandle`:

```svelte
<Handle type="source" position={Position.Right}  id="a" />
<Handle type="source" position={Position.Bottom} id="b" />
```

```js
const edges = [
  { id: 'e1', source: 'n1', sourceHandle: 'a', target: 'n2' },
  { id: 'e2', source: 'n1', sourceHandle: 'b', target: 'n3' },
];
```

Position multiple same-side handles with inline `style` (e.g. `left`/`top`) since the default is centered.

## Custom & typeless handles

**Custom handle (validation):** wrap `<Handle />` and pass `isValidConnection`:

```svelte
<script lang="ts">
  import { Handle, type HandleProps } from '@xyflow/svelte';
  let { source, ...rest }: HandleProps = $props();
</script>
<Handle type="target" isValidConnection={(c) => c.source === source} {...rest} />
```

**Typeless handles:** set `connectionMode={ConnectionMode.Loose}` on `<SvelteFlow>` so any handle accepts
both incoming and outgoing connections.

While connecting, handles get class names you can style: `connectingfrom`, `connectingto`, and `valid`.

## Dynamic handles → `useUpdateNodeInternals`

If you add/remove handles or move them **programmatically** (or after an async layout change), tell Svelte
Flow to re-measure:

```svelte
<script lang="ts">
  import { useUpdateNodeInternals } from '@xyflow/svelte';
  const updateNodeInternals = useUpdateNodeInternals();
  // after changing handles:
  updateNodeInternals(nodeId);
</script>
```

Skipping this is a top cause of "edge connects to the wrong place / at a weird angle."

## Utility classes

Add these classes to elements inside a custom node to control canvas interaction:

| Class | Effect | Use on |
|---|---|---|
| `nodrag` | element won't start a node drag (and won't select the node) | inputs, buttons, sliders |
| `nowheel` | scrolling the element won't pan/zoom the canvas | scroll containers |
| `nopan` | clicking/dragging the element won't pan the viewport | fixed overlays |

Class names are configurable via `noDragClass` / `noWheelClass` / `noPanClass` on `<SvelteFlow>`.

## `NodeResizer` & `NodeToolbar`

Both are imported from `@xyflow/svelte` and rendered **inside a custom node**.

```svelte
<script lang="ts">
  import { NodeResizer, NodeToolbar, Handle, Position, type NodeProps } from '@xyflow/svelte';
  let { data }: NodeProps = $props();
</script>

<NodeResizer minWidth={100} minHeight={30} />
<NodeToolbar>
  <button>delete</button><button>copy</button>
</NodeToolbar>

<Handle type="target" position={Position.Left} />
<div style:padding="10px">{data.label}</div>
<Handle type="source" position={Position.Right} />
```

`NodeToolbar` shows only when the node is selected by default (`isVisible` overrides; `position`/`align`
control placement). For custom resize handles use `NodeResizeControl` (accepts children/icons).

## Sub-flows (grouping with `parentId`)

A child node positions relative to its parent (`{ x: 0, y: 0 }` = parent's top-left). Set `parentId`:

```js
let nodes = $state.raw([
  { id: 'A', position: { x: 0, y: 0 }, data: { label: 'group' }, type: 'group',
    style: 'width: 300px; height: 200px;' },
  { id: 'B', position: { x: 20, y: 40 }, data: { label: 'child' }, parentId: 'A' },
]);
```

Rules:

- **Parents must appear before their children** in the `nodes` array.
- `extent: 'parent'` confines a child to the parent's bounds (the parent needs a width/height). Setting
  `extent` on a node **without** a `parentId` warns ("Only child nodes can use a parent extent").
- The built-in `'group'` type is a styled transparent container; any node type can be a parent.
- Children move with the parent; set `draggable: false` on a child to pin it.
