import type { MermaidGraph, MermaidNode, MermaidEdge, MermaidNodeShape, MermaidArrowType } from './types'

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
