<!--
  Custom edge template with a delete button on the label.
  Register as edgeTypes={{ button: ButtonEdge }}.
  EdgeLabel is a portal that escapes the SVG so you can render real HTML.
-->
<script lang="ts">
  import {
    BaseEdge,
    EdgeLabel,
    getBezierPath,
    useSvelteFlow,
    type EdgeProps,
  } from '@xyflow/svelte';

  let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps =
    $props();

  // Path utils return a tuple: [path, labelX, labelY, offsetX, offsetY].
  let [edgePath, labelX, labelY] = $derived(
    getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }),
  );

  const { deleteElements } = useSvelteFlow();
</script>

<BaseEdge {id} path={edgePath} />

<EdgeLabel x={labelX} y={labelY}>
  <!-- `nodrag nopan` so clicking the button doesn't pan the canvas. -->
  <button
    class="edge-delete nodrag nopan"
    aria-label="Delete edge"
    onclick={() => deleteElements({ edges: [{ id }] })}
  >
    ×
  </button>
</EdgeLabel>

<style>
  .edge-delete {
    width: 18px;
    height: 18px;
    line-height: 1;
    border: 1px solid #d0d0d8;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    font-size: 12px;
  }
  .edge-delete:hover {
    background: #ffe2e2;
    border-color: #ff8a8a;
  }
</style>
