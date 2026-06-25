<!--
  Golden-path Svelte Flow component for SvelteKit (Svelte 5 runes).
  Encodes the five rules: $state.raw + immutable updates, bind:nodes/edges,
  stylesheet imported, sized wrapper, nodeTypes/edgeTypes defined once.
  Copy into e.g. src/lib/components/Flow.svelte and adapt.
-->
<script lang="ts">
  import {
    SvelteFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    addEdge,
    type Node,
    type Edge,
    type NodeTypes,
    type EdgeTypes,
    type Connection,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  // Custom node/edge components (delete if you only use built-ins).
  import TextUpdaterNode from './TextUpdaterNode.svelte';
  import ButtonEdge from './ButtonEdge.svelte';

  // Rule 5: define these ONCE, keys must equal each node/edge `type`.
  const nodeTypes: NodeTypes = { textUpdater: TextUpdaterNode };
  const edgeTypes: EdgeTypes = { button: ButtonEdge };

  // Rule 1: $state.raw, treated as immutable.
  let nodes = $state.raw<Node[]>([
    { id: 'n1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Start' } },
    { id: 'n2', type: 'textUpdater', position: { x: 0, y: 140 }, data: { text: '' } },
  ]);

  let edges = $state.raw<Edge[]>([
    { id: 'n1-n2', type: 'button', source: 'n1', target: 'n2' },
  ]);

  // Rule 1: reassign on connect via the addEdge util (validates + dedupes).
  function handleConnect(connection: Connection) {
    edges = addEdge({ ...connection, type: 'button' }, edges);
  }
</script>

<!-- Rule 4: the wrapper needs width AND height. -->
<div style:width="100%" style:height="100%">
  <!-- Rule 2: bind:, don't pass. -->
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    fitView
    colorMode="system"
    onconnect={handleConnect}
  >
    <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
    <Controls />
    <MiniMap nodeColor={(node) => (node.type === 'input' ? '#6ede87' : '#bbb')} pannable zoomable />
  </SvelteFlow>
</div>
