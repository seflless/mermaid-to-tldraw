import type { Editor, TLShapeId, TLGeoShape, TLBindingId } from 'tldraw'
import type {
  PositionedGraph,
  PositionedNode,
  MermaidNodeShape,
  MermaidArrowType,
  MermaidToTldrawOptions,
  PositionedSequenceGraph,
  SequenceMessageType,
} from './types'
import { measureShapeText } from './measure'

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
        text: edge.label || '',
        labelPosition: 0.75,
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

// =====================
// Sequence Diagram Converter
// =====================

function getSequenceArrowheadEnd(type: SequenceMessageType): 'arrow' | 'triangle' | 'none' {
  switch (type) {
    case 'solid-arrow':
    case 'dotted-arrow':
      return 'triangle'
    case 'solid':
    case 'dotted':
      return 'arrow'
    case 'solid-cross':
    case 'dotted-cross':
      return 'none' // We'll add an X marker using a shape
    case 'solid-open':
    case 'dotted-open':
      return 'none'
    default:
      return 'arrow'
  }
}

function getSequenceArrowDash(type: SequenceMessageType): 'draw' | 'dashed' | 'solid' {
  switch (type) {
    case 'dotted':
    case 'dotted-arrow':
    case 'dotted-cross':
    case 'dotted-open':
      return 'dashed'
    default:
      return 'draw'
  }
}

export function convertSequenceToTldraw(
  editor: Editor,
  graph: PositionedSequenceGraph,
  options: MermaidToTldrawOptions = {}
): void {
  const { position = { x: 0, y: 0 }, scale = 1 } = options

  const participantIdMap = new Map<string, TLShapeId>()

  // Create participant boxes (geo shapes)
  const participantShapes: Parameters<Editor['createShapes']>[0] = []

  for (const p of graph.participants) {
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId
    participantIdMap.set(p.id, shapeId)

    // Use 'rectangle' for regular participants, or draw a stick figure for actors
    const isActor = p.type === 'actor'

    participantShapes.push({
      id: shapeId,
      type: 'geo',
      x: position.x + p.x * scale,
      y: position.y + p.y * scale,
      props: {
        geo: isActor ? 'oval' : 'rectangle',
        w: p.width * scale,
        h: p.height * scale,
        richText: toRichText(p.label),
        align: 'middle',
        verticalAlign: 'middle',
        size: 's',
        font: 'draw',
        fill: 'semi',
        color: 'black',
      },
    })
  }

  editor.createShapes(participantShapes)

  // Create lifelines (vertical lines from participant boxes to bottom)
  const lifelineShapes: Parameters<Editor['createShapes']>[0] = []

  for (const p of graph.participants) {
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId
    const startX = position.x + p.lifelineX * scale
    const startY = position.y + (p.y + p.height) * scale
    const endY = position.y + p.lifelineEndY * scale

    lifelineShapes.push({
      id: shapeId,
      type: 'line',
      x: startX,
      y: startY,
      props: {
        dash: 'dashed',
        size: 'm',
        color: 'grey',
        points: {
          a1: { id: 'a1', index: 'a1', x: 0, y: 0 },
          a2: { id: 'a2', index: 'a2', x: 0, y: endY - startY },
        },
      },
    })
  }

  editor.createShapes(lifelineShapes)

  // Create bottom participant boxes (mirrored at end of lifelines)
  const bottomParticipantShapes: Parameters<Editor['createShapes']>[0] = []

  for (const p of graph.participants) {
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId
    const isActor = p.type === 'actor'

    bottomParticipantShapes.push({
      id: shapeId,
      type: 'geo',
      x: position.x + p.x * scale,
      y: position.y + p.lifelineEndY * scale,
      props: {
        geo: isActor ? 'oval' : 'rectangle',
        w: p.width * scale,
        h: p.height * scale,
        richText: toRichText(p.label),
        align: 'middle',
        verticalAlign: 'middle',
        size: 's',
        font: 'draw',
        fill: 'semi',
        color: 'black',
      },
    })
  }

  editor.createShapes(bottomParticipantShapes)

  // Create activation boxes
  const activationShapes: Parameters<Editor['createShapes']>[0] = []

  for (const a of graph.activations) {
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId

    activationShapes.push({
      id: shapeId,
      type: 'geo',
      x: position.x + a.x * scale,
      y: position.y + a.y * scale,
      props: {
        geo: 'rectangle',
        w: a.width * scale,
        h: a.height * scale,
        fill: 'solid',
        color: 'light-blue',
        size: 's',
      },
    })
  }

  editor.createShapes(activationShapes)

  // Create message arrows with properly measured labels
  const messageShapes: Parameters<Editor['createShapes']>[0] = []
  const messageLabels: Parameters<Editor['createShapes']>[0] = []

  for (const m of graph.messages) {
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId
    const startX = position.x + m.fromX * scale
    const startY = position.y + m.y * scale
    const endX = position.x + m.toX * scale

    if (m.isSelf) {
      // Self-message: create a curved arrow (using line with multiple points)
      const selfWidth = 60 * scale
      const selfHeight = 30 * scale

      messageShapes.push({
        id: shapeId,
        type: 'line',
        x: startX,
        y: startY,
        props: {
          dash: getSequenceArrowDash(m.type),
          size: 'm',
          color: 'black',
          points: {
            a1: { id: 'a1', index: 'a1', x: 0, y: 0 },
            a2: { id: 'a2', index: 'a2', x: selfWidth, y: 0 },
            a3: { id: 'a3', index: 'a3', x: selfWidth, y: selfHeight },
            a4: { id: 'a4', index: 'a4', x: 0, y: selfHeight },
          },
        },
      })
    } else {
      // Normal message: straight arrow
      messageShapes.push({
        id: shapeId,
        type: 'arrow',
        x: startX,
        y: startY,
        props: {
          start: { x: 0, y: 0 },
          end: { x: endX - startX, y: 0 },
          arrowheadEnd: getSequenceArrowheadEnd(m.type),
          arrowheadStart: 'none',
          dash: getSequenceArrowDash(m.type),
          size: 'm',
          fill: 'none',
          color: 'black',
          font: 'draw',
        },
      })
    }

    // Add message label as text shape above the arrow — wrap long text
    if (m.label) {
      const labelId = `shape:${crypto.randomUUID()}` as TLShapeId
      const arrowWidth = Math.abs(endX - startX)
      // Allow labels to be up to 1.5x the arrow width, with a reasonable cap
      // This lets short labels stay single-line while long ones wrap
      const maxLabelWidth = Math.min(Math.max(arrowWidth * 1.5, 150) * scale, 300 * scale)

      // Measure with padding: 0 to get raw text dimensions
      const unconstrained = measureShapeText(editor, m.label, { size: 's', font: 'draw', padding: 0 })

      let labelW: number
      let labelH: number
      if (unconstrained.w <= maxLabelWidth) {
        labelW = unconstrained.w
        labelH = unconstrained.h
      } else {
        const wrapped = measureShapeText(editor, m.label, {
          size: 's',
          font: 'draw',
          maxWidth: maxLabelWidth,
          padding: 0,
        })
        labelW = maxLabelWidth
        labelH = wrapped.h
      }

      // Center label horizontally over the arrow midpoint
      const midX = m.isSelf
        ? startX + 70 * scale
        : startX + (endX - startX) / 2
      const labelX = midX - (labelW / 2) * scale
      // Position label just above the arrow with a small gap
      const labelY = startY - (labelH + 4) * scale

      messageLabels.push({
        id: labelId,
        type: 'text',
        x: labelX,
        y: labelY,
        props: {
          richText: toRichText(m.label),
          size: 's',
          font: 'draw',
          textAlign: 'middle',
          color: 'black',
          autoSize: unconstrained.w <= maxLabelWidth,
          ...(unconstrained.w > maxLabelWidth ? { w: labelW } : {}),
        },
      })
    }
  }

  editor.createShapes(messageShapes)
  editor.createShapes(messageLabels)

  // Create fragment boxes (loop, alt, etc.)
  const fragmentShapes: Parameters<Editor['createShapes']>[0] = []
  const fragmentLabels: Parameters<Editor['createShapes']>[0] = []

  for (const f of graph.fragments) {
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId

    // Fragment box
    fragmentShapes.push({
      id: shapeId,
      type: 'geo',
      x: position.x + f.x * scale,
      y: position.y + f.y * scale,
      props: {
        geo: 'rectangle',
        w: f.width * scale,
        h: f.height * scale,
        fill: 'none',
        color: 'grey',
        size: 's',
        dash: 'dashed',
      },
    })

    // Fragment type label (e.g. "loop", "alt") — top-left corner badge
    const labelText = f.label ? `${f.type} [${f.label}]` : f.type
    const labelId = `shape:${crypto.randomUUID()}` as TLShapeId

    fragmentLabels.push({
      id: labelId,
      type: 'text',
      x: position.x + (f.x + 8) * scale,
      y: position.y + (f.y + 4) * scale,
      props: {
        richText: toRichText(labelText),
        size: 's',
        font: 'draw',
        color: 'grey',
        autoSize: true,
      },
    })

    // Add section dividers for alt/else
    if (f.sections && f.sections.length > 0) {
      for (const section of f.sections) {
        // Dashed horizontal line at the section boundary — positioned above the section's first message
        const sectionMsg = graph.messages[section.startIndex]
        const sectionY = sectionMsg
          ? position.y + (sectionMsg.y - 80) * scale
          : position.y + f.y * scale

        const dividerLineId = `shape:${crypto.randomUUID()}` as TLShapeId
        fragmentShapes.push({
          id: dividerLineId,
          type: 'line',
          x: position.x + f.x * scale,
          y: sectionY,
          props: {
            dash: 'dashed',
            size: 's',
            color: 'grey',
            points: {
              a1: { id: 'a1', index: 'a1', x: 0, y: 0 },
              a2: { id: 'a2', index: 'a2', x: f.width * scale, y: 0 },
            },
          },
        })

        // Section label (e.g. "else")
        if (section.label) {
          const sectionLabelId = `shape:${crypto.randomUUID()}` as TLShapeId
          fragmentLabels.push({
            id: sectionLabelId,
            type: 'text',
            x: position.x + (f.x + 8) * scale,
            y: sectionY + 4 * scale,
            props: {
              richText: toRichText(`[${section.label}]`),
              size: 's',
              font: 'draw',
              color: 'grey',
              autoSize: true,
            },
          })
        }
      }
    }
  }

  editor.createShapes(fragmentShapes)
  editor.createShapes(fragmentLabels)

  // Create notes (using geo rectangles with yellow fill)
  const noteShapes: Parameters<Editor['createShapes']>[0] = []

  for (const n of graph.notes) {
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId

    noteShapes.push({
      id: shapeId,
      type: 'geo',
      x: position.x + n.x * scale,
      y: position.y + n.y * scale,
      props: {
        geo: 'rectangle',
        w: n.width * scale,
        h: n.height * scale,
        richText: toRichText(n.text),
        align: 'middle',
        verticalAlign: 'middle',
        size: 's',
        font: 'draw',
        fill: 'solid',
        color: 'yellow',
      },
    })
  }

  editor.createShapes(noteShapes)
}
