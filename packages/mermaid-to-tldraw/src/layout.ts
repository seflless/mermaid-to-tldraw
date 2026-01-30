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

// =====================
// Sequence Diagram Layout
// =====================

const SEQ_PARTICIPANT_WIDTH = 120
const SEQ_PARTICIPANT_HEIGHT = 50
const SEQ_PARTICIPANT_GAP = 80
const SEQ_MESSAGE_HEIGHT = 50
const SEQ_TOP_MARGIN = 20
const SEQ_LEFT_MARGIN = 40
const SEQ_ACTIVATION_WIDTH = 16
const SEQ_NOTE_WIDTH = 150
const SEQ_NOTE_HEIGHT = 40
const SEQ_SELF_MESSAGE_WIDTH = 60
const SEQ_FRAGMENT_PADDING = 10

export function layoutSequenceGraph(graph: SequenceGraph): PositionedSequenceGraph {
  const participantCount = graph.participants.length
  const messageCount = graph.messages.length

  // Calculate total height (participants + lifelines + messages)
  const lifelineEndY = SEQ_TOP_MARGIN + SEQ_PARTICIPANT_HEIGHT + (messageCount + 1) * SEQ_MESSAGE_HEIGHT + 40

  // Position participants horizontally
  const positionedParticipants: PositionedSequenceParticipant[] = graph.participants.map((p, i) => {
    const width = Math.max(SEQ_PARTICIPANT_WIDTH, p.label.length * 10 + 30)
    const x = SEQ_LEFT_MARGIN + i * (SEQ_PARTICIPANT_WIDTH + SEQ_PARTICIPANT_GAP)
    const lifelineX = x + width / 2

    return {
      ...p,
      x,
      y: SEQ_TOP_MARGIN,
      width,
      height: SEQ_PARTICIPANT_HEIGHT,
      lifelineX,
      lifelineEndY,
    }
  })

  // Create a map for quick participant lookup
  const participantXMap = new Map<string, number>()
  for (const p of positionedParticipants) {
    participantXMap.set(p.id, p.lifelineX)
  }

  // Position messages vertically
  const messageStartY = SEQ_TOP_MARGIN + SEQ_PARTICIPANT_HEIGHT + SEQ_MESSAGE_HEIGHT
  const positionedMessages: PositionedSequenceMessage[] = graph.messages.map((m, i) => {
    const fromX = participantXMap.get(m.from) || 0
    const toX = participantXMap.get(m.to) || 0
    const y = messageStartY + i * SEQ_MESSAGE_HEIGHT
    const isSelf = m.from === m.to

    return {
      ...m,
      fromX,
      toX: isSelf ? fromX + SEQ_SELF_MESSAGE_WIDTH : toX,
      y,
      isSelf,
    }
  })

  // Position notes
  const positionedNotes: PositionedSequenceNote[] = graph.notes.map((note) => {
    let x = 0
    const participantX = participantXMap.get(note.participants[0]) || 0

    if (note.position === 'left') {
      x = participantX - SEQ_NOTE_WIDTH - 20
    } else if (note.position === 'right') {
      x = participantX + 20
    } else {
      // "over" - center over participant(s)
      if (note.participants.length > 1) {
        const x1 = participantXMap.get(note.participants[0]) || 0
        const x2 = participantXMap.get(note.participants[1]) || 0
        x = (x1 + x2) / 2 - SEQ_NOTE_WIDTH / 2
      } else {
        x = participantX - SEQ_NOTE_WIDTH / 2
      }
    }

    // Position notes at the message index where they appear in the flow
    const y = messageStartY + note.messageIndex * SEQ_MESSAGE_HEIGHT - SEQ_MESSAGE_HEIGHT / 4

    return {
      ...note,
      x,
      y,
      width: SEQ_NOTE_WIDTH,
      height: SEQ_NOTE_HEIGHT,
    }
  })

  // Position activations
  const positionedActivations: PositionedSequenceActivation[] = graph.activations.map(a => {
    const participantX = participantXMap.get(a.participant) || 0
    const startY = messageStartY + a.startIndex * SEQ_MESSAGE_HEIGHT - SEQ_MESSAGE_HEIGHT / 4
    const endY = messageStartY + a.endIndex * SEQ_MESSAGE_HEIGHT + SEQ_MESSAGE_HEIGHT / 4
    const height = endY - startY

    return {
      ...a,
      x: participantX - SEQ_ACTIVATION_WIDTH / 2,
      y: startY,
      width: SEQ_ACTIVATION_WIDTH,
      height: Math.max(height, SEQ_MESSAGE_HEIGHT / 2),
    }
  })

  // Position fragments
  const positionedFragments: PositionedSequenceFragment[] = graph.fragments.map(f => {
    // Find the leftmost and rightmost participants involved in messages within the fragment
    let minX = Infinity
    let maxX = -Infinity

    for (let i = f.startIndex; i < f.endIndex; i++) {
      if (i < graph.messages.length) {
        const msg = positionedMessages[i]
        minX = Math.min(minX, msg.fromX, msg.toX)
        maxX = Math.max(maxX, msg.fromX, msg.toX)
      }
    }

    // Fallback if no messages
    if (minX === Infinity) {
      minX = positionedParticipants[0]?.lifelineX || 0
      maxX = positionedParticipants[positionedParticipants.length - 1]?.lifelineX || 200
    }

    const x = minX - SEQ_FRAGMENT_PADDING - 30
    const width = maxX - minX + SEQ_FRAGMENT_PADDING * 2 + 60
    const startY = messageStartY + f.startIndex * SEQ_MESSAGE_HEIGHT - SEQ_MESSAGE_HEIGHT / 2
    const endY = messageStartY + f.endIndex * SEQ_MESSAGE_HEIGHT + SEQ_MESSAGE_HEIGHT / 4
    const height = endY - startY

    return {
      ...f,
      x,
      y: startY,
      width,
      height: Math.max(height, SEQ_MESSAGE_HEIGHT),
    }
  })

  // Calculate total dimensions
  const totalWidth = participantCount > 0
    ? SEQ_LEFT_MARGIN * 2 + participantCount * SEQ_PARTICIPANT_WIDTH + (participantCount - 1) * SEQ_PARTICIPANT_GAP
    : 400
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
