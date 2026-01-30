import { useState, useCallback, useRef } from 'react'
import { Tldraw, Editor, TLShapeId } from 'tldraw'
import { autoConvertToTldraw } from 'mermaid-to-tldraw'
import { MermaidShapeUtil, type MermaidShape } from './MermaidShape'
import 'tldraw/tldraw.css'

const FLOWCHART_EXAMPLE = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do Thing]
    B -->|No| D[Other Thing]
    C --> E[End]
    D --> E`

const SEQUENCE_EXAMPLE = `sequenceDiagram
    participant Alice
    participant Bob
    participant Charlie

    Alice->>+Bob: Hello Bob, how are you?
    Bob-->>Alice: Hey Alice, I'm good!

    Alice->>Bob: Did you hear about the meeting?
    Bob->>+Charlie: Hi Charlie, Alice mentioned a meeting
    Charlie-->>-Bob: Yes, it's at 3pm
    Bob-->>-Alice: Charlie says it's at 3pm

    Note over Alice,Bob: They agree to attend

    loop Every hour
        Alice->>Bob: Any updates?
        Bob-->>Alice: Nothing yet
    end

    alt Meeting confirmed
        Alice->>Charlie: See you at 3pm!
    else Meeting cancelled
        Alice->>Charlie: Meeting cancelled
    end

    Alice-xBob: Connection lost
    Bob-)Charlie: Async notification`

const EXAMPLES = {
  sequence: SEQUENCE_EXAMPLE,
  flowchart: FLOWCHART_EXAMPLE,
}

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
  const [mermaidText, setMermaidText] = useState(EXAMPLES.sequence)
  const [selectedExample, setSelectedExample] = useState<keyof typeof EXAMPLES>('sequence')
  const editorRef = useRef<Editor | null>(null)

  const handleExampleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const example = e.target.value as keyof typeof EXAMPLES
    setSelectedExample(example)
    setMermaidText(EXAMPLES[example])
  }, [])

  const handleConvertNative = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const x = getNextX(editor)

    // Auto-detect diagram type and convert to tldraw shapes
    autoConvertToTldraw(editor, mermaidText, {
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
        <select
          value={selectedExample}
          onChange={handleExampleChange}
          style={{
            padding: '8px',
            fontSize: '13px',
            fontWeight: 500,
            border: 'none',
            borderBottom: '1px solid #e0e0e0',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <option value="sequence">Sequence Diagram</option>
          <option value="flowchart">Flowchart</option>
        </select>
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
