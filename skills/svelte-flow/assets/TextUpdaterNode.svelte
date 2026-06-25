<!--
  Custom node template. Register as nodeTypes={{ textUpdater: TextUpdaterNode }}.
  Node data shape: { text: string }. Custom nodes have NO default styling.
-->
<script lang="ts">
  import { Handle, Position, useSvelteFlow, type NodeProps } from '@xyflow/svelte';

  // Type the data for autocomplete: NodeProps<Node<{ text: string }, 'textUpdater'>>
  let { id, data }: NodeProps = $props();

  const { updateNodeData } = useSvelteFlow();
</script>

<div class="text-updater">
  <label for={`text-${id}`}>Text</label>
  <!-- `nodrag` so typing/selecting in the input doesn't drag the node. -->
  <input
    id={`text-${id}`}
    class="nodrag"
    value={(data.text as string) ?? ''}
    oninput={(e) => updateNodeData(id, { text: e.currentTarget.value })}
  />

  <Handle type="target" position={Position.Left} />
  <Handle type="source" position={Position.Right} />
</div>

<style>
  .text-updater {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid #d0d0d8;
    border-radius: 8px;
    background: white;
    font-size: 12px;
  }
  .text-updater input {
    border: 1px solid #d0d0d8;
    border-radius: 4px;
    padding: 4px 6px;
  }
</style>
