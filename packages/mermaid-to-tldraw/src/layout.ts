import type { Editor } from 'tldraw'
import dagre from '@dagrejs/dagre'
import type {
  MermaidGraph,
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  SequenceGraph,
  PositionedSequenceGraph,
  PositionedSequenceParticipant,
  PositionedSequenceMessage,
  PositionedSequenceNote,
  PositionedSequenceActivation,
  PositionedSequenceFragment,
} from './types'
import { measureShapeText } from './measure'

const MIN_NODE_WIDTH = 80
const MIN_NODE_HEIGHT = 44
const NODE_SEP = 50
const RANK_SEP = 80

export function layoutGraph(editor: Editor, graph: MermaidGraph): PositionedGraph {
  const g = new dagre.graphlib.Graph()

  g.setGraph({
    rankdir: graph.direction === 'LR' || graph.direction === 'RL' ? 'LR' : 'TB',
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    marginx: 20,
    marginy: 20,
  })

  g.setDefaultEdgeLabel(() => ({}))

  // Measure nodes using tldraw's text measurement
  for (const node of graph.nodes) {
    let measured = measureShapeText(editor, node.label, { size: 'm', font: 'draw' })
    let width = Math.max(MIN_NODE_WIDTH, measured.w)
    let height = Math.max(MIN_NODE_HEIGHT, measured.h)

    if (node.shape === 'diamond') {
      // Constrain text width to force wrapping on long labels,
      // preventing extremely wide flat diamonds.
      const maxTextW = 120
      if (measured.w > maxTextW) {
        measured = measureShapeText(editor, node.label, { size: 'm', font: 'draw', maxWidth: maxTextW })
        width = Math.max(MIN_NODE_WIDTH, measured.w)
        height = Math.max(MIN_NODE_HEIGHT, measured.h)
      }

      // Scale up for diamond geometry and enforce square proportions.
      const side = Math.max(width, height) * 1.5
      width = side
      height = side
    }

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

// =====================
// Sequence Diagram Layout
// =====================

const SEQ_PARTICIPANT_GAP = 80
const SEQ_MESSAGE_ROW_HEIGHT = 50  // base row height for each message
const SEQ_LABEL_HEIGHT = 28        // extra space for message label text above arrow
const SEQ_TOP_MARGIN = 20
const SEQ_LEFT_MARGIN = 40
const SEQ_ACTIVATION_WIDTH = 16
const SEQ_NOTE_WIDTH = 150
const SEQ_NOTE_HEIGHT = 40
const SEQ_SELF_MESSAGE_WIDTH = 60
const SEQ_FRAGMENT_PADDING = 25
const SEQ_FRAGMENT_LABEL_HEIGHT = 45  // space for the fragment type label badge
const SEQ_SECTION_DIVIDER_HEIGHT = 90 // space for else/section dividers (section label + gap + message label)

export function layoutSequenceGraph(editor: Editor, graph: SequenceGraph): PositionedSequenceGraph {
  const messageCount = graph.messages.length

  // Measure participant labels
  const participantSizes = graph.participants.map(p => {
    const measured = measureShapeText(editor, p.label, { size: 's', font: 'draw' })
    return {
      width: Math.max(80, measured.w),
      height: Math.max(40, measured.h),
    }
  })

  const maxParticipantHeight = Math.max(...participantSizes.map(s => s.height), 40)

  // Position participants horizontally, accounting for varying widths
  let currentX = SEQ_LEFT_MARGIN
  const positionedParticipants: PositionedSequenceParticipant[] = graph.participants.map((p, i) => {
    const { width } = participantSizes[i]
    const x = currentX
    const lifelineX = x + width / 2
    currentX += width + SEQ_PARTICIPANT_GAP

    return {
      ...p,
      x,
      y: SEQ_TOP_MARGIN,
      width,
      height: maxParticipantHeight,
      lifelineX,
      lifelineEndY: 0, // computed after messages
    }
  })

  // Create a map for quick participant lookup
  const participantXMap = new Map<string, number>()
  for (const p of positionedParticipants) {
    participantXMap.set(p.id, p.lifelineX)
  }

  // Build a set of indices where fragments start, and section dividers occur
  const fragmentStartIndices = new Set<number>()
  const sectionDividerIndices = new Set<number>()
  for (const f of graph.fragments) {
    fragmentStartIndices.add(f.startIndex)
    if (f.sections) {
      for (const s of f.sections) {
        sectionDividerIndices.add(s.startIndex)
      }
    }
  }

  // Pre-measure notes and build a map of messageIndex → measured height
  const SEQ_NOTE_MAX_WIDTH = 200
  const SEQ_NOTE_PADDING = 20 // vertical breathing room around notes
  const noteHeightAtIndex = new Map<number, number>()
  const noteMeasuredCache = new Map<number, { width: number; height: number }>()
  for (let ni = 0; ni < graph.notes.length; ni++) {
    const n = graph.notes[ni]
    const unconstrained = measureShapeText(editor, n.text, { size: 's', font: 'draw' })
    let noteWidth: number
    let noteHeight: number
    if (unconstrained.w <= SEQ_NOTE_MAX_WIDTH) {
      noteWidth = Math.max(SEQ_NOTE_WIDTH, unconstrained.w)
      noteHeight = Math.max(SEQ_NOTE_HEIGHT, unconstrained.h)
    } else {
      const wrapped = measureShapeText(editor, n.text, { size: 's', font: 'draw', maxWidth: SEQ_NOTE_MAX_WIDTH })
      noteWidth = SEQ_NOTE_MAX_WIDTH
      noteHeight = Math.max(SEQ_NOTE_HEIGHT, wrapped.h)
    }
    noteMeasuredCache.set(ni, { width: noteWidth, height: noteHeight })
    // Track the tallest note at each message index
    const existing = noteHeightAtIndex.get(n.messageIndex) || 0
    noteHeightAtIndex.set(n.messageIndex, Math.max(existing, noteHeight))
  }

  // Compute cumulative Y for each message row, adding extra space for
  // fragment labels, section dividers, and notes
  const messageStartY = SEQ_TOP_MARGIN + maxParticipantHeight + SEQ_LABEL_HEIGHT + SEQ_MESSAGE_ROW_HEIGHT
  const messageYPositions: number[] = []

  let y = messageStartY
  for (let i = 0; i < messageCount; i++) {
    // Add extra space if a fragment starts at this message index
    if (fragmentStartIndices.has(i)) {
      y += SEQ_FRAGMENT_LABEL_HEIGHT
    }
    // Add extra space if a section divider (else) occurs at this index
    if (sectionDividerIndices.has(i)) {
      y += SEQ_SECTION_DIVIDER_HEIGHT
    }
    // Add extra space if a note is at this message index (use actual measured height + padding)
    const noteH = noteHeightAtIndex.get(i)
    if (noteH) {
      y += noteH + SEQ_NOTE_PADDING
    }

    messageYPositions.push(y)
    y += SEQ_MESSAGE_ROW_HEIGHT + SEQ_LABEL_HEIGHT
  }

  // Total diagram height
  const lifelineEndY = (messageYPositions[messageCount - 1] ?? messageStartY) + SEQ_MESSAGE_ROW_HEIGHT + 40

  // Update participant lifeline end Y
  for (const p of positionedParticipants) {
    p.lifelineEndY = lifelineEndY
  }

  // Position messages at their computed Y
  const positionedMessages: PositionedSequenceMessage[] = graph.messages.map((m, i) => {
    const fromX = participantXMap.get(m.from) || 0
    const toX = participantXMap.get(m.to) || 0
    const isSelf = m.from === m.to

    return {
      ...m,
      fromX,
      toX: isSelf ? fromX + SEQ_SELF_MESSAGE_WIDTH : toX,
      y: messageYPositions[i],
      isSelf,
    }
  })

  // Position notes (using pre-measured dimensions from cache)
  const positionedNotes: PositionedSequenceNote[] = graph.notes.map((note, ni) => {
    let x = 0
    const participantX = participantXMap.get(note.participants[0]) || 0

    const cached = noteMeasuredCache.get(ni)!
    const noteWidth = cached.width
    const noteHeight = cached.height

    if (note.position === 'left') {
      x = participantX - noteWidth - 20
    } else if (note.position === 'right') {
      x = participantX + 20
    } else {
      if (note.participants.length > 1) {
        const x1 = participantXMap.get(note.participants[0]) || 0
        const x2 = participantXMap.get(note.participants[1]) || 0
        x = (x1 + x2) / 2 - noteWidth / 2
      } else {
        x = participantX - noteWidth / 2
      }
    }

    // Position note above its message row — if a fragment also starts at this
    // index, push the note above the fragment box
    let noteY: number
    if (fragmentStartIndices.has(note.messageIndex)) {
      // Fragment start Y = msgY - SEQ_LABEL_HEIGHT - SEQ_FRAGMENT_LABEL_HEIGHT - 10
      const fragmentTopY = messageYPositions[note.messageIndex] - SEQ_LABEL_HEIGHT - SEQ_FRAGMENT_LABEL_HEIGHT - 10
      noteY = fragmentTopY - noteHeight - 8
    } else {
      noteY = messageYPositions[note.messageIndex] - noteHeight - 4
    }

    return {
      ...note,
      x,
      y: noteY,
      width: noteWidth,
      height: noteHeight,
    }
  })

  // Position activations using actual message Y positions
  const positionedActivations: PositionedSequenceActivation[] = graph.activations.map(a => {
    const participantX = participantXMap.get(a.participant) || 0
    const startMsgY = messageYPositions[a.startIndex] ?? messageStartY
    const endMsgY = messageYPositions[a.endIndex] ?? messageYPositions[messageCount - 1] ?? messageStartY
    const aStartY = startMsgY - SEQ_MESSAGE_ROW_HEIGHT / 4
    const aEndY = endMsgY + SEQ_MESSAGE_ROW_HEIGHT / 4
    const height = aEndY - aStartY

    return {
      ...a,
      x: participantX - SEQ_ACTIVATION_WIDTH / 2,
      y: aStartY,
      width: SEQ_ACTIVATION_WIDTH,
      height: Math.max(height, SEQ_MESSAGE_ROW_HEIGHT / 2),
    }
  })

  // Position fragments using actual message Y positions
  const positionedFragments: PositionedSequenceFragment[] = graph.fragments.map(f => {
    let minX = Infinity
    let maxX = -Infinity

    for (let i = f.startIndex; i < f.endIndex; i++) {
      if (i < graph.messages.length) {
        const msg = positionedMessages[i]
        minX = Math.min(minX, msg.fromX, msg.toX)
        maxX = Math.max(maxX, msg.fromX, msg.toX)
      }
    }

    if (minX === Infinity) {
      minX = positionedParticipants[0]?.lifelineX || 0
      maxX = positionedParticipants[positionedParticipants.length - 1]?.lifelineX || 200
    }

    const fx = minX - SEQ_FRAGMENT_PADDING - 30
    const width = maxX - minX + SEQ_FRAGMENT_PADDING * 2 + 60

    // Fragment starts well above the first message row (label + message label + padding)
    const startMsgY = messageYPositions[f.startIndex] ?? messageStartY
    const fStartY = startMsgY - SEQ_LABEL_HEIGHT - SEQ_FRAGMENT_LABEL_HEIGHT - 10

    // Fragment ends below the last message in the fragment
    const lastMsgIndex = Math.min(f.endIndex - 1, messageCount - 1)
    const endMsgY = messageYPositions[lastMsgIndex] ?? messageStartY
    const fEndY = endMsgY + SEQ_MESSAGE_ROW_HEIGHT / 2

    const height = fEndY - fStartY

    return {
      ...f,
      x: fx,
      y: fStartY,
      width,
      height: Math.max(height, SEQ_MESSAGE_ROW_HEIGHT * 2),
    }
  })

  // Calculate total dimensions
  const totalWidth = currentX - SEQ_PARTICIPANT_GAP + SEQ_LEFT_MARGIN
  const totalHeight = lifelineEndY + 40

  return {
    participants: positionedParticipants,
    messages: positionedMessages,
    notes: positionedNotes,
    activations: positionedActivations,
    fragments: positionedFragments,
    width: totalWidth,
    height: totalHeight,
  }
}
