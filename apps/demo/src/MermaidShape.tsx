import { useState, useEffect } from 'react'
import {
  HTMLContainer,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  BaseBoxShapeUtil,
} from 'tldraw'
import mermaid from 'mermaid'

// Initialize mermaid with minimal config - we'll style via CSS
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#f9f9f9',
    primaryTextColor: '#1d1d1d',
    primaryBorderColor: '#1d1d1d',
    lineColor: '#1d1d1d',
    textColor: '#1d1d1d',
    mainBkg: '#f9f9f9',
    nodeBorder: '#1d1d1d',
    edgeLabelBackground: 'transparent',
    clusterBkg: '#f5f5f5',
    clusterBorder: '#1d1d1d',
  },
  flowchart: {
    curve: 'basis',
    padding: 20,
  },
})

// CSS to make Mermaid look like TLDraw
const TLDRAW_MERMAID_CSS = `
  /* Use TLDraw's hand-drawn font */
  @import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:wght@400;500&display=swap');

  .mermaid-tldraw * {
    font-family: 'Shantell Sans', cursive !important;
  }

  /* Thicker strokes like TLDraw */
  .mermaid-tldraw .node rect,
  .mermaid-tldraw .node circle,
  .mermaid-tldraw .node ellipse,
  .mermaid-tldraw .node polygon,
  .mermaid-tldraw .node path {
    stroke-width: 2.5px !important;
    stroke: #1d1d1d !important;
  }

  /* Arrow/edge styling */
  .mermaid-tldraw .edgePath path.path {
    stroke-width: 2px !important;
    stroke: #1d1d1d !important;
  }

  /* Arrowhead styling */
  .mermaid-tldraw marker path {
    fill: #1d1d1d !important;
    stroke: #1d1d1d !important;
  }

  /* Diamond shapes */
  .mermaid-tldraw .node .label-container {
    stroke-width: 2.5px !important;
  }

  /* Text styling */
  .mermaid-tldraw .nodeLabel,
  .mermaid-tldraw .edgeLabel,
  .mermaid-tldraw .label {
    font-size: 16px !important;
    fill: #1d1d1d !important;
  }

  /* Edge labels */
  .mermaid-tldraw .edgeLabel rect {
    fill: white !important;
    opacity: 0.9;
  }
`

export type MermaidShape = TLBaseShape<
  'mermaid',
  {
    w: number
    h: number
    source: string
  }
>

export class MermaidShapeUtil extends BaseBoxShapeUtil<MermaidShape> {
  static override type = 'mermaid' as const

  getDefaultProps(): MermaidShape['props'] {
    return {
      w: 400,
      h: 300,
      source: 'graph TD\n    A[Start] --> B[End]',
    }
  }

  override canEdit() {
    return true
  }

  override canResize() {
    return true
  }

  override onResize(shape: MermaidShape, info: TLResizeInfo<MermaidShape>) {
    return resizeBox(shape, info)
  }

  component(shape: MermaidShape) {
    return <MermaidRenderer shape={shape} />
  }

  indicator(shape: MermaidShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />
  }
}

function MermaidRenderer({ shape }: { shape: MermaidShape }) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const id = `mermaid-${shape.id.replace(/[^a-zA-Z0-9]/g, '')}`
        const { svg } = await mermaid.render(id, shape.props.source)
        if (!cancelled) {
          setSvg(svg)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to render')
          setSvg('')
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [shape.props.source, shape.id])

  return (
    <HTMLContainer
      style={{
        width: shape.props.w,
        height: shape.props.h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        overflow: 'visible',
        pointerEvents: 'all',
      }}
    >
      <style>{TLDRAW_MERMAID_CSS}</style>
      {error ? (
        <div style={{ color: '#e03131', padding: 16, fontSize: 14, fontFamily: 'monospace' }}>
          {error}
        </div>
      ) : (
        <div
          className="mermaid-tldraw"
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      )}
    </HTMLContainer>
  )
}
