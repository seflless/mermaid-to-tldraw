import dagre from '@dagrejs/dagre'
import type { MermaidGraph, PositionedGraph, PositionedNode, PositionedEdge } from './types'

const DEFAULT_NODE_WIDTH = 150
const DEFAULT_NODE_HEIGHT = 50
const NODE_SEP = 50
const RANK_SEP = 80

export function layoutGraph(graph: MermaidGraph): PositionedGraph {
  const g = new dagre.graphlib.Graph()

  g.setGraph({
    rankdir: graph.direction === 'LR' || graph.direction === 'RL' ? 'LR' : 'TB',
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    marginx: 20,
    marginy: 20,
  })

  g.setDefaultEdgeLabel(() => ({}))

  // Add nodes
  for (const node of graph.nodes) {
    const width = Math.max(DEFAULT_NODE_WIDTH, node.label.length * 10 + 40)
    const height = DEFAULT_NODE_HEIGHT
    g.setNode(node.id, { width, height })
  }

  // Add edges
  for (const edge of graph.edges) {
    g.setEdge(edge.from, edge.to)
  }

  // Run layout
  dagre.layout(g)

  // Extract positioned nodes
  const positionedNodes: PositionedNode[] = graph.nodes.map(node => {
    const layoutNode = g.node(node.id)
    return {
      ...node,
      x: layoutNode.x,
      y: layoutNode.y,
      width: layoutNode.width,
      height: layoutNode.height,
    }
  })

  // Extract positioned edges with points
  const positionedEdges: PositionedEdge[] = graph.edges.map(edge => {
    const layoutEdge = g.edge(edge.from, edge.to)
    return {
      ...edge,
      points: layoutEdge.points || [],
    }
  })

  // Calculate graph dimensions
  const graphInfo = g.graph()

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    width: graphInfo.width || 400,
    height: graphInfo.height || 300,
  }
}
