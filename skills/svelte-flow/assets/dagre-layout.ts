// Dagre auto-layout helper for Svelte Flow.
//   bun add @dagrejs/dagre
//
// Usage (reassign the arrays — rule 1):
//   import { getLayoutedElements } from '$lib/dagre-layout';
//   const laid = getLayoutedElements(nodes, edges, 'TB');
//   nodes = laid.nodes;
//   edges = laid.edges;
//
// Run it after nodes are measured (node.measured.width/height exist), e.g. once
// useNodesInitialized() is true, so dimensions feed dagre correctly.

import dagre from '@dagrejs/dagre';
import { Position, type Node, type Edge } from '@xyflow/svelte';

type Direction = 'TB' | 'BT' | 'LR' | 'RL';

const DEFAULT_WIDTH = 172;
const DEFAULT_HEIGHT = 36;

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: Direction = 'TB',
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction });

  const isHorizontal = direction === 'LR' || direction === 'RL';

  for (const node of nodes) {
    g.setNode(node.id, {
      width: node.measured?.width ?? node.width ?? DEFAULT_WIDTH,
      height: node.measured?.height ?? node.height ?? DEFAULT_HEIGHT,
    });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const { x, y, width, height } = g.node(node.id);
    return {
      ...node,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      // dagre returns the node center; Svelte Flow positions by the top-left corner.
      position: { x: x - width / 2, y: y - height / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}
