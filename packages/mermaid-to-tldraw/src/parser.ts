import type {
  MermaidGraph,
  MermaidNode,
  MermaidEdge,
  MermaidNodeShape,
  MermaidArrowType,
  SequenceGraph,
  SequenceParticipant,
  SequenceMessage,
  SequenceMessageType,
  SequenceNote,
  SequenceActivation,
  SequenceFragment,
  DiagramType,
} from './types'

const DIRECTION_REGEX = /^\s*(graph|flowchart)\s+(TB|TD|BT|LR|RL)/i

// Node patterns: id[label], id{label}, id(label), id((label)), etc.
const NODE_PATTERNS: Array<{ regex: RegExp; shape: MermaidNodeShape }> = [
  { regex: /\(\((.+?)\)\)/, shape: 'circle' },
  { regex: /\[\[(.+?)\]\]/, shape: 'subroutine' },
  { regex: /\[\((.+?)\)\]/, shape: 'cylinder' },
  { regex: /\(\[(.+?)\]\)/, shape: 'stadium' },
  { regex: /\{\{(.+?)\}\}/, shape: 'hexagon' },
  { regex: /\{(.+?)\}/, shape: 'diamond' },
  { regex: /\[\/(.+?)\/\]/, shape: 'parallelogram' },
  { regex: /\[\\(.+?)\\\]/, shape: 'trapezoid' },
  { regex: />(.+?)\]/, shape: 'asymmetric' },
  { regex: /\((.+?)\)/, shape: 'round' },
  { regex: /\[(.+?)\]/, shape: 'rectangle' },
]

// Arrow patterns
const ARROW_PATTERNS: Array<{ regex: RegExp; type: MermaidArrowType }> = [
  { regex: /==+>/, type: 'thick' },
  { regex: /==+/, type: 'thick-open' },
  { regex: /-.+?-+>/, type: 'arrow' }, // with label
  { regex: /-\.+->/, type: 'dotted' },
  { regex: /-\.+-/, type: 'dotted-open' },
  { regex: /--+>/, type: 'arrow' },
  { regex: /---+/, type: 'open' },
  { regex: /-->/, type: 'arrow' },
  { regex: /---/, type: 'open' },
]

function parseNodeDefinition(text: string): { id: string; label: string; shape: MermaidNodeShape } | null {
  const trimmed = text.trim()

  // Extract the node ID (everything before the shape delimiter)
  const idMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/)
  if (!idMatch) return null

  const id = idMatch[1]
  const rest = trimmed.slice(id.length)

  if (!rest) {
    // Just an ID with no shape definition
    return { id, label: id, shape: 'rectangle' }
  }

  for (const { regex, shape } of NODE_PATTERNS) {
    const match = rest.match(regex)
    if (match) {
      return { id, label: match[1].trim(), shape }
    }
  }

  return { id, label: id, shape: 'rectangle' }
}

// Tokenize a line into nodes and arrows
function tokenizeLine(line: string): Array<{ type: 'node'; text: string } | { type: 'arrow'; arrowType: MermaidArrowType; label?: string }> {
  const tokens: Array<{ type: 'node'; text: string } | { type: 'arrow'; arrowType: MermaidArrowType; label?: string }> = []
  let remaining = line.trim()

  while (remaining.length > 0) {
    let matched = false

    // Try to match an arrow first
    for (const { regex, type } of ARROW_PATTERNS) {
      const match = remaining.match(regex)
      if (match && match.index === 0) {
        let label: string | undefined

        // Check for |label| after arrow
        const afterArrow = remaining.slice(match[0].length)
        const labelMatch = afterArrow.match(/^\|([^|]+)\|/)
        if (labelMatch) {
          label = labelMatch[1]
          remaining = afterArrow.slice(labelMatch[0].length).trim()
        } else {
          remaining = afterArrow.trim()
        }

        tokens.push({ type: 'arrow', arrowType: type, label })
        matched = true
        break
      }
    }

    if (matched) continue

    // Try to match a node (with optional shape definition)
    const nodeMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(\[\[.*?\]\]|\(\(.*?\)\)|\(\[.*?\]\)|\[\(.*?\)\]|\{\{.*?\}\}|\{.*?\}|\[\/.*?\/\]|\[\\.*?\\\]|>.*?\]|\(.*?\)|\[.*?\])?/)
    if (nodeMatch) {
      tokens.push({ type: 'node', text: nodeMatch[0] })
      remaining = remaining.slice(nodeMatch[0].length).trim()
      matched = true
    }

    if (!matched) {
      // Skip unknown character
      remaining = remaining.slice(1).trim()
    }
  }

  return tokens
}

function parseEdges(line: string): Array<{ from: string; to: string; label?: string; type: MermaidArrowType }> {
  const tokens = tokenizeLine(line)
  const edges: Array<{ from: string; to: string; label?: string; type: MermaidArrowType }> = []

  let lastNode: string | null = null

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'node') {
      const parsed = parseNodeDefinition(token.text)
      if (parsed) {
        // Check if there was an arrow before this node
        if (lastNode !== null && i > 0) {
          const prevToken = tokens[i - 1]
          if (prevToken.type === 'arrow') {
            edges.push({
              from: lastNode,
              to: parsed.id,
              label: prevToken.label,
              type: prevToken.arrowType,
            })
          }
        }
        lastNode = parsed.id
      }
    }
  }

  return edges
}

export function parseMermaid(text: string): MermaidGraph {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))

  // Parse direction
  let direction: MermaidGraph['direction'] = 'TD'
  const dirMatch = lines[0]?.match(DIRECTION_REGEX)
  if (dirMatch) {
    direction = dirMatch[2].toUpperCase() as MermaidGraph['direction']
    if (direction === 'TB') direction = 'TD'
  }

  const nodesMap = new Map<string, MermaidNode>()
  const edges: MermaidEdge[] = []

  for (const line of lines) {
    if (DIRECTION_REGEX.test(line)) continue
    if (line.startsWith('subgraph') || line === 'end') continue

    // Try to parse edges (handles chained arrows like A --> B --> C)
    const lineEdges = parseEdges(line)
    if (lineEdges.length > 0) {
      for (const edge of lineEdges) {
        edges.push(edge)
        // Ensure nodes exist
        if (!nodesMap.has(edge.from)) {
          const node = parseNodeFromLine(line, edge.from)
          nodesMap.set(edge.from, node)
        }
        if (!nodesMap.has(edge.to)) {
          const node = parseNodeFromLine(line, edge.to)
          nodesMap.set(edge.to, node)
        }
      }
      continue
    }

    // Try to parse as standalone node definition
    const node = parseNodeDefinition(line)
    if (node && !nodesMap.has(node.id)) {
      nodesMap.set(node.id, node)
    }
  }

  return {
    direction,
    nodes: Array.from(nodesMap.values()),
    edges,
  }
}

function parseNodeFromLine(line: string, nodeId: string): MermaidNode {
  // Find the node definition in the line
  const regex = new RegExp(`${nodeId}(\\[.*?\\]|\\{.*?\\}|\\(.*?\\)|\\(\\(.*?\\)\\)|\\[\\[.*?\\]\\]|\\{\\{.*?\\}\\})`)
  const match = line.match(regex)

  if (match) {
    const fullDef = nodeId + match[1]
    const parsed = parseNodeDefinition(fullDef)
    if (parsed) return parsed
  }

  return { id: nodeId, label: nodeId, shape: 'rectangle' }
}

// =====================
// Diagram Type Detection
// =====================

export function detectDiagramType(text: string): DiagramType {
  const trimmed = text.trim().toLowerCase()
  if (trimmed.startsWith('sequencediagram')) {
    return 'sequence'
  }
  return 'flowchart'
}

// =====================
// Sequence Diagram Parser
// =====================

const SEQUENCE_DIRECTION_REGEX = /^\s*sequenceDiagram/i

// Message arrow patterns (order matters - longer patterns first)
const MESSAGE_PATTERNS: Array<{ regex: RegExp; type: SequenceMessageType }> = [
  { regex: /-->>/, type: 'dotted-arrow' },
  { regex: /->>/, type: 'solid-arrow' },
  { regex: /--x/i, type: 'dotted-cross' },
  { regex: /-x/i, type: 'solid-cross' },
  { regex: /--\)/, type: 'dotted-open' },
  { regex: /-\)/, type: 'solid-open' },
  { regex: /-->/, type: 'dotted' },
  { regex: /->/, type: 'solid' },
]

function parseSequenceMessage(
  line: string,
  participantMap: Map<string, SequenceParticipant>
): SequenceMessage | null {
  // Try each arrow pattern
  for (const { regex, type } of MESSAGE_PATTERNS) {
    const match = line.match(regex)
    if (match && match.index !== undefined) {
      const beforeArrow = line.slice(0, match.index).trim()
      const afterArrow = line.slice(match.index + match[0].length).trim()

      // Parse "to" part and label (format: "To: label" or "To:label")
      const colonIndex = afterArrow.indexOf(':')
      if (colonIndex === -1) continue

      let toPart = afterArrow.slice(0, colonIndex).trim()
      const label = afterArrow.slice(colonIndex + 1).trim()

      // Check for activation markers (+ or - at start or end of toPart)
      let activate = false
      let deactivate = false

      // Check for + or - at the START of toPart (e.g., "->>+Bob" results in toPart="+Bob")
      if (toPart.startsWith('+')) {
        activate = true
        toPart = toPart.slice(1).trim()
      } else if (toPart.startsWith('-')) {
        deactivate = true
        toPart = toPart.slice(1).trim()
      }

      // Also check for + or - at the END of toPart (for formats like "Bob+" if any)
      if (toPart.endsWith('+')) {
        activate = true
        toPart = toPart.slice(0, -1).trim()
      } else if (toPart.endsWith('-')) {
        deactivate = true
        toPart = toPart.slice(0, -1).trim()
      }

      const to = toPart
      const from = beforeArrow

      // Ensure both participants exist (auto-create if not)
      if (!participantMap.has(from)) {
        participantMap.set(from, {
          id: from,
          label: from,
          type: 'participant',
          order: participantMap.size,
        })
      }
      if (!participantMap.has(to)) {
        participantMap.set(to, {
          id: to,
          label: to,
          type: 'participant',
          order: participantMap.size,
        })
      }

      return { from, to, label, type, activate, deactivate }
    }
  }
  return null
}

function parseSequenceNote(
  line: string,
  participantMap: Map<string, SequenceParticipant>
): Omit<SequenceNote, 'messageIndex'> | null {
  // Note left of X: text
  // Note right of X: text
  // Note over X: text
  // Note over X,Y: text
  const noteMatch = line.match(/^Note\s+(left\s+of|right\s+of|over)\s+([^:]+):\s*(.+)$/i)
  if (!noteMatch) return null

  const positionStr = noteMatch[1].toLowerCase()
  const participantsStr = noteMatch[2].trim()
  const text = noteMatch[3].trim()

  let position: 'left' | 'right' | 'over'
  if (positionStr.includes('left')) {
    position = 'left'
  } else if (positionStr.includes('right')) {
    position = 'right'
  } else {
    position = 'over'
  }

  // Parse participants (can be "X" or "X,Y")
  const participants = participantsStr.split(',').map(p => p.trim())

  // Auto-create participants if they don't exist
  for (const p of participants) {
    if (!participantMap.has(p)) {
      participantMap.set(p, {
        id: p,
        label: p,
        type: 'participant',
        order: participantMap.size,
      })
    }
  }

  return { participants, text, position }
}

export function parseSequenceDiagram(text: string): SequenceGraph {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))

  const participantMap = new Map<string, SequenceParticipant>()
  const messages: SequenceMessage[] = []
  const notes: SequenceNote[] = []
  const activations: SequenceActivation[] = []
  const fragments: SequenceFragment[] = []

  // Track active activations per participant
  const activeActivations = new Map<string, number>() // participant -> start message index

  // Track fragment stack for nested fragments
  const fragmentStack: { type: SequenceFragment['type']; label: string; startIndex: number; sections: { label: string; startIndex: number }[] }[] = []

  for (const line of lines) {
    // Skip diagram declaration
    if (SEQUENCE_DIRECTION_REGEX.test(line)) continue

    // Skip autonumber directive
    if (line.toLowerCase() === 'autonumber') continue

    // Parse participant/actor declaration
    const participantMatch = line.match(/^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i)
    if (participantMatch) {
      const type = participantMatch[1].toLowerCase() as 'participant' | 'actor'
      const id = participantMatch[2]
      const label = participantMatch[3]?.trim() || id
      participantMap.set(id, {
        id,
        label,
        type,
        order: participantMap.size,
      })
      continue
    }

    // Parse create participant
    const createMatch = line.match(/^create\s+(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i)
    if (createMatch) {
      const type = createMatch[1].toLowerCase() as 'participant' | 'actor'
      const id = createMatch[2]
      const label = createMatch[3]?.trim() || id
      participantMap.set(id, {
        id,
        label,
        type,
        order: participantMap.size,
      })
      continue
    }

    // Parse activate/deactivate
    const activateMatch = line.match(/^activate\s+(\S+)$/i)
    if (activateMatch) {
      const participant = activateMatch[1]
      if (!activeActivations.has(participant)) {
        activeActivations.set(participant, messages.length)
      }
      continue
    }

    const deactivateMatch = line.match(/^deactivate\s+(\S+)$/i)
    if (deactivateMatch) {
      const participant = deactivateMatch[1]
      const startIndex = activeActivations.get(participant)
      if (startIndex !== undefined) {
        activations.push({
          participant,
          startIndex,
          endIndex: messages.length,
        })
        activeActivations.delete(participant)
      }
      continue
    }

    // Parse fragment start (loop, alt, opt, par, break, critical, rect)
    const fragmentMatch = line.match(/^(loop|alt|opt|par|break|critical|rect)\s*(.*)$/i)
    if (fragmentMatch) {
      const type = fragmentMatch[1].toLowerCase() as SequenceFragment['type']
      const label = fragmentMatch[2].trim()
      fragmentStack.push({
        type,
        label,
        startIndex: messages.length,
        sections: [],
      })
      continue
    }

    // Parse else (within alt fragment)
    const elseMatch = line.match(/^else\s*(.*)$/i)
    if (elseMatch && fragmentStack.length > 0) {
      const currentFragment = fragmentStack[fragmentStack.length - 1]
      if (currentFragment.type === 'alt') {
        currentFragment.sections.push({
          label: elseMatch[1].trim(),
          startIndex: messages.length,
        })
      }
      continue
    }

    // Parse end (close fragment)
    if (line.toLowerCase() === 'end') {
      const fragment = fragmentStack.pop()
      if (fragment) {
        fragments.push({
          ...fragment,
          endIndex: messages.length,
        })
      }
      continue
    }

    // Parse note
    const note = parseSequenceNote(line, participantMap)
    if (note) {
      notes.push({ ...note, messageIndex: messages.length })
      continue
    }

    // Parse message
    const message = parseSequenceMessage(line, participantMap)
    if (message) {
      // Handle inline activation
      if (message.activate) {
        activeActivations.set(message.to, messages.length)
      }
      if (message.deactivate) {
        const startIndex = activeActivations.get(message.to)
        if (startIndex !== undefined) {
          activations.push({
            participant: message.to,
            startIndex,
            endIndex: messages.length + 1,
          })
          activeActivations.delete(message.to)
        }
      }
      messages.push(message)
    }
  }

  // Close any unclosed activations
  for (const [participant, startIndex] of activeActivations) {
    activations.push({
      participant,
      startIndex,
      endIndex: messages.length,
    })
  }

  return {
    participants: Array.from(participantMap.values()).sort((a, b) => a.order - b.order),
    messages,
    notes,
    activations,
    fragments,
  }
}
