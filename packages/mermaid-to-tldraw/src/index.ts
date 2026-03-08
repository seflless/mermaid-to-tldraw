import type { Editor } from 'tldraw'
import { parseMermaid, parseSequenceDiagram, detectDiagramType } from './parser'
import { layoutGraph, layoutSequenceGraph } from './layout'
import { convertToTldraw, convertSequenceToTldraw } from './converter'
import type { MermaidToTldrawOptions } from './types'

export { parseMermaid, parseSequenceDiagram, detectDiagramType } from './parser'
export { layoutGraph, layoutSequenceGraph } from './layout'
export { convertToTldraw, convertSequenceToTldraw } from './converter'
export { measureShapeText } from './measure'
export * from './types'

/**
 * Convert a flowchart diagram to TLDraw shapes
 */
export function mermaidToTldraw(
  editor: Editor,
  mermaidText: string,
  options?: MermaidToTldrawOptions
): void {
  const graph = parseMermaid(mermaidText)
  console.log('Parsed graph:', JSON.stringify(graph, null, 2))
  const positionedGraph = layoutGraph(editor, graph)
  convertToTldraw(editor, positionedGraph, options)
}

/**
 * Convert a sequence diagram to TLDraw shapes
 */
export function sequenceToTldraw(
  editor: Editor,
  mermaidText: string,
  options?: MermaidToTldrawOptions
): void {
  const graph = parseSequenceDiagram(mermaidText)
  console.log('Parsed sequence graph:', JSON.stringify(graph, null, 2))
  const positionedGraph = layoutSequenceGraph(editor, graph)
  convertSequenceToTldraw(editor, positionedGraph, options)
}

/**
 * Auto-detect diagram type and convert to TLDraw shapes
 */
export function autoConvertToTldraw(
  editor: Editor,
  mermaidText: string,
  options?: MermaidToTldrawOptions
): void {
  const diagramType = detectDiagramType(mermaidText)
  console.log('Detected diagram type:', diagramType)

  if (diagramType === 'sequence') {
    sequenceToTldraw(editor, mermaidText, options)
  } else {
    mermaidToTldraw(editor, mermaidText, options)
  }
}
