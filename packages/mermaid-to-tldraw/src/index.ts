import type { Editor } from 'tldraw'
import { parseMermaid } from './parser'
import { layoutGraph } from './layout'
import { convertToTldraw } from './converter'
import type { MermaidToTldrawOptions } from './types'

export { parseMermaid } from './parser'
export { layoutGraph } from './layout'
export { convertToTldraw } from './converter'
export * from './types'

export function mermaidToTldraw(
  editor: Editor,
  mermaidText: string,
  options?: MermaidToTldrawOptions
): void {
  const graph = parseMermaid(mermaidText)
  console.log('Parsed graph:', JSON.stringify(graph, null, 2))
  const positionedGraph = layoutGraph(graph)
  convertToTldraw(editor, positionedGraph, options)
}
