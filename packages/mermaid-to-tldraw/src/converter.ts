import type { Editor, TLShapeId, TLGeoShape, TLBindingId } from 'tldraw'
import type { PositionedGraph, PositionedNode, MermaidNodeShape, MermaidArrowType, MermaidToTldrawOptions } from './types'

type TLGeoType = TLGeoShape['props']['geo']

function toRichText(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

const SHAPE_MAP: Record<MermaidNodeShape, TLGeoType> = {
  rectangle: 'rectangle',
  diamond: 'diamond',
  stadium: 'rectangle', // TLDraw doesn't have stadium
  circle: 'ellipse',
  subroutine: 'rectangle',
  cylinder: 'rectangle', // fallback
  asymmetric: 'rectangle', // fallback
  hexagon: 'hexagon',
  parallelogram: 'rhombus', // closest approximation
  trapezoid: 'trapezoid',
  'trapezoid-alt': 'trapezoid',
  round: 'oval',
}

function getArrowheadEnd(type: MermaidArrowType): 'arrow' | 'none' {
  if (type === 'open' || type === 'dotted-open' || type === 'thick-open') {
    return 'none'
  }
  return 'arrow'
}

function getArrowDash(type: MermaidArrowType): 'draw' | 'dashed' | 'solid' {
  if (type === 'dotted' || type === 'dotted-open') {
    return 'dashed'
  }
  return 'draw'
}

function getArrowSize(type: MermaidArrowType): 's' | 'm' | 'l' {
  if (type === 'thick' || type === 'thick-open') {
    return 'l'
  }
  return 'm'
}

export function convertToTldraw(
  editor: Editor,
  graph: PositionedGraph,
  options: MermaidToTldrawOptions = {}
): void {
  const { position = { x: 0, y: 0 }, scale = 1 } = options

  const nodeIdMap = new Map<string, TLShapeId>()

  // Create geo shapes for nodes
  const geoShapes: Parameters<Editor['createShapes']>[0] = []

  for (const node of graph.nodes) {
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId
    nodeIdMap.set(node.id, shapeId)

    const geo = SHAPE_MAP[node.shape] || 'rectangle'

    geoShapes.push({
      id: shapeId,
      type: 'geo',
      x: position.x + (node.x - node.width / 2) * scale,
      y: position.y + (node.y - node.height / 2) * scale,
      props: {
        geo,
        w: node.width * scale,
        h: node.height * scale,
        richText: toRichText(node.label),
        align: 'middle',
        verticalAlign: 'middle',
        size: 'm',
        font: 'draw',
        fill: 'semi',
        color: 'black',
      },
    })
  }

  editor.createShapes(geoShapes)

  // Build a map of node positions for arrow placement
  const nodePositions = new Map<string, PositionedNode>()
  for (const node of graph.nodes) {
    nodePositions.set(node.id, node)
  }

  // Create arrows for edges
  const arrowShapes: Parameters<Editor['createShapes']>[0] = []
  const arrowBindings: Array<{ arrowId: TLShapeId; fromId: TLShapeId; toId: TLShapeId }> = []

  for (const edge of graph.edges) {
    const fromShapeId = nodeIdMap.get(edge.from)
    const toShapeId = nodeIdMap.get(edge.to)
    const fromNode = nodePositions.get(edge.from)
    const toNode = nodePositions.get(edge.to)

    if (!fromShapeId || !toShapeId || !fromNode || !toNode) continue

    const arrowId = `shape:${crypto.randomUUID()}` as TLShapeId

    // Calculate arrow start/end positions (center of nodes)
    const startX = position.x + fromNode.x * scale
    const startY = position.y + fromNode.y * scale
    const endX = position.x + toNode.x * scale
    const endY = position.y + toNode.y * scale

    arrowShapes.push({
      id: arrowId,
      type: 'arrow',
      x: startX,
      y: startY,
      props: {
        start: { x: 0, y: 0 },
        end: { x: endX - startX, y: endY - startY },
        arrowheadEnd: getArrowheadEnd(edge.type),
        arrowheadStart: 'none',
        dash: getArrowDash(edge.type),
        size: getArrowSize(edge.type),
        fill: 'none',
        color: 'black',
        font: 'draw',
      },
    })

    arrowBindings.push({ arrowId, fromId: fromShapeId, toId: toShapeId })
  }

  editor.createShapes(arrowShapes)

  // Create bindings to connect arrows to shapes
  const bindings: Parameters<Editor['createBindings']>[0] = []

  for (const { arrowId, fromId, toId } of arrowBindings) {
    bindings.push({
      id: `binding:${crypto.randomUUID()}` as TLBindingId,
      type: 'arrow',
      fromId: arrowId,
      toId: fromId,
      props: {
        terminal: 'start',
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    })
    bindings.push({
      id: `binding:${crypto.randomUUID()}` as TLBindingId,
      type: 'arrow',
      fromId: arrowId,
      toId: toId,
      props: {
        terminal: 'end',
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    })
  }

  editor.createBindings(bindings)
}
