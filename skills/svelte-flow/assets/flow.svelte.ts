// Shared graph state in a module (Svelte 5 runes).
// $state.raw values can't be exported directly while staying reactive, so we expose
// getters/setters and consume them with function bindings in the component:
//
//   import { getNodes, setNodes, getEdges, setEdges } from '$lib/flow.svelte';
//   <SvelteFlow bind:nodes={getNodes, setNodes} bind:edges={getEdges, setEdges} />
//
// Mutating helpers stay immutable: new objects + reassigned arrays (rule 1).

import { addEdge, type Node, type Edge, type Connection } from '@xyflow/svelte';

let nodes = $state.raw<Node[]>([]);
let edges = $state.raw<Edge[]>([]);

export const getNodes = () => nodes;
export const setNodes = (next: Node[]) => (nodes = next);
export const getEdges = () => edges;
export const setEdges = (next: Edge[]) => (edges = next);

/** Append a node immutably. */
export function addNode(node: Node) {
  nodes = [...nodes, node];
}

/** Shallow-merge into a node's `data` with a fresh object so Svelte Flow detects the change. */
export function updateNodeData(id: string, patch: Record<string, unknown>) {
  nodes = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
}

/** Move a node immutably. */
export function moveNode(id: string, position: { x: number; y: number }) {
  nodes = nodes.map((n) => (n.id === id ? { ...n, position } : n));
}

/** Connect two handles using the validating addEdge util. */
export function connect(connection: Connection) {
  edges = addEdge(connection, edges);
}

/** Remove a node and any edges touching it. */
export function removeNode(id: string) {
  nodes = nodes.filter((n) => n.id !== id);
  edges = edges.filter((e) => e.source !== id && e.target !== id);
}
