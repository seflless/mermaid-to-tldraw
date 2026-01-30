export type MermaidNodeShape =
  | 'rectangle'
  | 'diamond'
  | 'stadium'
  | 'circle'
  | 'subroutine'
  | 'cylinder'
  | 'asymmetric'
  | 'hexagon'
  | 'parallelogram'
  | 'trapezoid'
  | 'trapezoid-alt'
  | 'round'

export type MermaidArrowType =
  | 'arrow'
  | 'open'
  | 'dotted'
  | 'dotted-open'
  | 'thick'
  | 'thick-open'

export interface MermaidNode {
  id: string
  label: string
  shape: MermaidNodeShape
}

export interface MermaidEdge {
  from: string
  to: string
  label?: string
  type: MermaidArrowType
}

export interface MermaidGraph {
  direction: 'TB' | 'TD' | 'BT' | 'LR' | 'RL'
  nodes: MermaidNode[]
  edges: MermaidEdge[]
}

export interface PositionedNode extends MermaidNode {
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedEdge extends MermaidEdge {
  points: Array<{ x: number; y: number }>
}

export interface PositionedGraph {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  width: number
  height: number
}

export interface MermaidToTldrawOptions {
  position?: { x: number; y: number }
  scale?: number
}

// =====================
// Sequence Diagram Types
// =====================

export type SequenceParticipantType = 'participant' | 'actor'

export type SequenceMessageType =
  | 'solid'           // ->
  | 'dotted'          // -->
  | 'solid-arrow'     // ->>
  | 'dotted-arrow'    // -->>
  | 'solid-cross'     // -x
  | 'dotted-cross'    // --x
  | 'solid-open'      // -)
  | 'dotted-open'     // --)

export type SequenceNotePosition = 'left' | 'right' | 'over'

export interface SequenceParticipant {
  id: string
  label: string
  type: SequenceParticipantType
  order: number
}

export interface SequenceMessage {
  from: string
  to: string
  label: string
  type: SequenceMessageType
  activate?: boolean   // + suffix
  deactivate?: boolean // - suffix
}

export interface SequenceNote {
  participants: string[]
  text: string
  position: SequenceNotePosition
  messageIndex: number  // The message index where this note appears in the flow
}

export interface SequenceActivation {
  participant: string
  startIndex: number
  endIndex: number
}

export interface SequenceFragment {
  type: 'loop' | 'alt' | 'opt' | 'par' | 'break' | 'critical' | 'rect'
  label: string
  startIndex: number
  endIndex: number
  sections?: { label: string; startIndex: number }[]  // for alt/else
}

export interface SequenceGraph {
  participants: SequenceParticipant[]
  messages: SequenceMessage[]
  notes: SequenceNote[]
  activations: SequenceActivation[]
  fragments: SequenceFragment[]
}

export interface PositionedSequenceParticipant extends SequenceParticipant {
  x: number
  y: number
  width: number
  height: number
  lifelineX: number
  lifelineEndY: number
}

export interface PositionedSequenceMessage extends SequenceMessage {
  fromX: number
  toX: number
  y: number
  isSelf: boolean
}

export interface PositionedSequenceNote extends SequenceNote {
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedSequenceActivation extends SequenceActivation {
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedSequenceFragment extends SequenceFragment {
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedSequenceGraph {
  participants: PositionedSequenceParticipant[]
  messages: PositionedSequenceMessage[]
  notes: PositionedSequenceNote[]
  activations: PositionedSequenceActivation[]
  fragments: PositionedSequenceFragment[]
  width: number
  height: number
}

export type DiagramType = 'flowchart' | 'sequence'
