import { useState, useCallback, useRef } from 'react'
import { Tldraw, Editor, TLShapeId } from 'tldraw'
import { mermaidToTldraw } from 'mermaid-to-tldraw'
import { MermaidShapeUtil, type MermaidShape } from './MermaidShape'
import 'tldraw/tldraw.css'

const DEFAULT_MERMAID = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do Thing]
    B -->|No| D[Other Thing]
    C --> E[End]
    D --> E`

const customShapeUtils = [MermaidShapeUtil]

// Get the rightmost edge of all shapes + gap
function getNextX(editor: Editor, gap = 100): number {
  const shapes = editor.getCurrentPageShapes()
  if (shapes.length === 0) return 100

  let maxRight = 0
  for (const shape of shapes) {
    const bounds = editor.getShapePageBounds(shape.id)
    if (bounds) {
      maxRight = Math.max(maxRight, bounds.maxX)
    }
  }
  return maxRight + gap
}

export default function App() {
  const [mermaidText, setMermaidText] = useState(DEFAULT_MERMAID)
  const editorRef = useRef<Editor | null>(null)

  const handleConvertNative = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const x = getNextX(editor)

    // Convert mermaid to tldraw shapes
    mermaidToTldraw(editor, mermaidText, {
      position: { x, y: 100 },
    })
  }, [mermaidText])

  const handleConvertMermaid = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const x = getNextX(editor)

    // Create a mermaid shape
    const shapeId = `shape:${crypto.randomUUID()}` as TLShapeId
    editor.createShape<MermaidShape>({
      id: shapeId,
      type: 'mermaid',
      x,
      y: 100,
      props: {
        w: 600,
        h: 500,
        source: mermaidText,
      },
    })
  }, [mermaidText])

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{
        width: '300px',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #e0e0e0',
        background: '#f8f8f8',
      }}>
        <textarea
          value={mermaidText}
          onChange={(e) => setMermaidText(e.target.value)}
          style={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '13px',
            padding: '8px',
            border: 'none',
            borderBottom: '1px solid #e0e0e0',
            resize: 'none',
            outline: 'none',
            background: 'transparent',
          }}
          placeholder="Enter mermaid diagram..."
        />
        <div style={{ display: 'flex', gap: 1 }}>
          <button
            onClick={handleConvertNative}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontSize: '13px',
              fontWeight: 500,
              background: '#2563eb',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Native Shapes
          </button>
          <button
            onClick={handleConvertMermaid}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontSize: '13px',
              fontWeight: 500,
              background: '#16a34a',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Mermaid Shape
          </button>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <Tldraw onMount={handleMount} shapeUtils={customShapeUtils} />
      </div>
    </div>
  )
}
