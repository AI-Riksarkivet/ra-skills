# Svelte 5 + SvelteKit integration

The part Claude gets wrong. Svelte Flow 1.0 is a Svelte 5 library; its reactivity model is unlike
React Flow's and unlike Svelte Flow 0.x.

## Contents
- Reactive state: `$state.raw` and immutability
- Updating nodes & edges
- Binding (`bind:nodes` / `bind:edges`) and function bindings
- Hooks return `.current`
- The provider / context rule
- Binding the viewport
- TypeScript: typing nodes, edges, custom components
- Svelte transitions on nodes & edges
- Server-side rendering (SSR / SSG)

## Reactive state: `$state.raw` and immutability

Declare nodes and edges with [`$state.raw`](https://svelte.dev/docs/svelte/$state#$state.raw), **not**
`$state`:

```svelte
<script lang="ts">
  let nodes = $state.raw([...]);
  let edges = $state.raw([...]);
</script>
```

`$state` makes *every* nested property of *every* node deeply reactive. With many nodes/handles that is a
serious performance problem, so Svelte Flow treats `nodes`/`edges` as **immutable** and uses `$state.raw`.

Consequences:

- Mutating in place does nothing: `nodes[0].position.x = 100` will **not** update the flow.
- To trigger an update you must (a) create a new object for anything you change, **and** (b) reassign the
  array.

```js
// ❌ no update
nodes[0].position.x = 100;

// ✅ reassign with a new node object
nodes = nodes.map((n) =>
  n.id === '1' ? { ...n, position: { ...n.position, x: 100 } } : n
);
```

## Updating nodes & edges

Three correct ways, in order of preference:

1. **`updateNodeData` / `updateNode`** (from `useSvelteFlow`) — least error-prone for single nodes:
   ```js
   const { updateNode, updateNodeData } = useSvelteFlow();
   updateNodeData('1', { text: 'hi' });                       // shallow-merges into data
   updateNode('1', (n) => ({ ...n, position: { x: 0, y: 0 } }));
   ```
   When updating `data`, always pass a **new** data object — Svelte Flow needs a new reference to detect
   the change.
2. **Reassign the array** with `.map`/`.filter` (shown above).
3. **Hook `.current` reassignment** — `useNodes`, `useEdges`, `useViewport` allow writing back to
   `.current`:
   ```js
   const nodes = useNodes();
   nodes.current = nodes.current.map(/* … */);
   ```

To add an edge on connect, use the `addEdge` util (it validates + dedupes):
```js
import { addEdge } from '@xyflow/svelte';
<SvelteFlow bind:nodes bind:edges onconnect={(c) => (edges = addEdge(c, edges))} />
```

## Binding: `bind:nodes` / `bind:edges`

Svelte Flow writes drag, selection, and connection changes back into your arrays through **two-way
binding**. Use `bind:`, not prop-passing:

```svelte
<SvelteFlow bind:nodes bind:edges />   <!-- ✅ -->
<SvelteFlow {nodes} {edges} />         <!-- ❌ changes are lost -->
```

### State in a separate module → function bindings

`$state.raw` values can't be exported and stay reactive across module boundaries directly. Export
getters/setters and use [function bindings](https://svelte.dev/docs/svelte/bind#Function-bindings):

```ts
// flow.svelte.ts
let nodes = $state.raw([...]);
let edges = $state.raw([...]);
export const getNodes = () => nodes;
export const setNodes = (n) => (nodes = n);
export const getEdges = () => edges;
export const setEdges = (e) => (edges = e);
```

```svelte
<script lang="ts">
  import { getNodes, setNodes, getEdges, setEdges } from './flow.svelte.ts';
</script>
<SvelteFlow bind:nodes={getNodes, setNodes} bind:edges={getEdges, setEdges} />
```

See [`assets/flow.svelte.ts`](../assets/flow.svelte.ts) for a complete store with helpers.

## Hooks return `.current`

In Svelte Flow 1.0 hooks return a **reactive object with a `.current` property**, not a writable store
(the 0.x model). This mirrors Svelte's own `MediaQuery`-style reactive classes.

```svelte
<script lang="ts">
  import { useNodes, useEdges } from '@xyflow/svelte';
  const nodes = useNodes();
  const edges = useEdges();
  $inspect(nodes.current);                      // ✅ read via .current
  $effect(() => console.log(edges.current.length));
</script>

{#each nodes.current as node (node.id)}…{/each}
```

There is **no** `$nodes` auto-subscription and **no** `nodes.subscribe(...)`. For `useNodes`/`useEdges`/
`useViewport` you may also reassign `.current`.

## The provider / context rule

Hooks (`useNodes`, `useSvelteFlow`, `useConnection`, `useStore`, …) read the flow's Svelte context. They
work only in a component that is a **child of `<SvelteFlow>`** or wrapped in **`<SvelteFlowProvider>`**.

Calling a hook in the same component that renders `<SvelteFlow>`, *before* the flow mounts, throws
"Could not find a Svelte Flow context." Fixes:

- Move the hook call into a child component placed inside `<SvelteFlow>…</SvelteFlow>`, **or**
- Wrap the whole thing in `<SvelteFlowProvider>` (in a parent component).

Use `<SvelteFlowProvider>` when you need flow state **outside** `<SvelteFlow>` (e.g. a sidebar), when you
have **multiple flows** on one page (one provider each), or to **persist state across routes** (place the
provider *outside* the router).

```svelte
<SvelteFlowProvider>
  <SvelteFlow bind:nodes bind:edges />
  <Sidebar />            <!-- can call useNodes() because it's inside the provider -->
</SvelteFlowProvider>
```

## Binding the viewport

```svelte
<script lang="ts">
  import type { Viewport } from '@xyflow/svelte';
  let viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
</script>
<SvelteFlow bind:viewport bind:nodes bind:edges />
```

## TypeScript

Import types from `@xyflow/svelte`. Type your arrays and custom-component props.

```svelte
<script lang="ts">
  import { SvelteFlow, type Node, type Edge, type FitViewOptions } from '@xyflow/svelte';
  let nodes = $state.raw<Node[]>([...]);
  let edges = $state.raw<Edge[]>([...]);
  const fitViewOptions: FitViewOptions = { padding: 0.2 };
</script>
```

### Custom node / edge data types

`Node<Data, Type>` and `Edge<Data, Type>` take generics. Define data with `type` (not `interface` — the
data must satisfy `Record<string, unknown>`, which a plain `interface` doesn't):

```ts
// ✅
type NumberNodeData = { value: number };
export type NumberNode = Node<NumberNodeData, 'number'>;
```

In the custom component, pass the type to `NodeProps` / `EdgeProps`:

```svelte
<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  let { id, data }: NodeProps<NumberNode> = $props();   // data.value is typed
</script>
```

### Union types for the whole flow

Many APIs (the component, hooks, callbacks) accept a `NodeType` / `EdgeType` generic — a **union** of all
your custom types. Include `BuiltInNode` / `BuiltInEdge` if you use any built-in `type`
(`'input'`/`'output'`/`'default'`, `'straight'`/`'step'`/`'smoothstep'`/`'bezier'`):

```ts
import type { BuiltInNode, BuiltInEdge } from '@xyflow/svelte';
export type AppNode = BuiltInNode | NumberNode | TextNode;
export type AppEdge = BuiltInEdge | CustomEdge;
```

```ts
const { getNodes, updateNodeData } = useSvelteFlow<AppNode, AppEdge>();
```

### Type guards

Narrow a union before reading type-specific data:

```ts
function isNumberNode(n: AppNode): n is NumberNode { return n.type === 'number'; }
const numberNodes = $derived(nodes.filter(isNumberNode));
```

## Svelte transitions on nodes & edges

Nodes and edges are real DOM elements, so Svelte `transition:`/`in:`/`out:` work on them — but you **must
add the `|global` modifier**, because they mount inside Svelte Flow's own structure, not directly in your
component's block:

```svelte
<div transition:fade|global>…</div>
```

## Server-side rendering (SSR / SSG)

Svelte Flow normally measures nodes and handles in the browser. On the server those measurements don't
exist, so you must provide them:

- **Node dimensions:** set `width`/`height` (static) or `initialWidth`/`initialHeight` (replaced after
  hydration) on each node — Svelte Flow can't measure DOM on the server.
- **Handle positions:** set the node's `handles` array explicitly (`type`, `position`, `x`, `y`).
- **Container size + fitView:** pass `width` and `height` to `<SvelteFlow>` so `fitView` has dimensions.

```svelte
<SvelteFlow {nodes} {edges} width={1000} height={500} fitView>
  <Background />
</SvelteFlow>
```

Render to a static HTML string with Svelte's server renderer:

```js
import { render } from 'svelte/server';
import Flow from './Flow.svelte';
const { body } = render(Flow, { props: { nodes, edges, width, height } });
```

For `colorMode="system"` during SSR, pass a `colorModeSSR` fallback to avoid a flash. For client-side
image export instead, see the download-image example (uses `html-to-image`, pinned to `1.11.11`).
