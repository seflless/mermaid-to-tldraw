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
