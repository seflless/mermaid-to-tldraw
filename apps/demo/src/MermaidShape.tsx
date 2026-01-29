import { useState, useEffect, useRef } from 'react'
import {
  HTMLContainer,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  BaseBoxShapeUtil,
} from 'tldraw'
import mermaid from 'mermaid'

// Initialize mermaid with TLDraw-like config
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#fdfdfd',
    primaryTextColor: '#1d1d1d',
    primaryBorderColor: '#1d1d1d',
    lineColor: '#1d1d1d',
    textColor: '#1d1d1d',
    mainBkg: '#fdfdfd',
    nodeBorder: '#1d1d1d',
    edgeLabelBackground: '#ffffff',
    clusterBkg: '#f5f5f5',
    clusterBorder: '#1d1d1d',
  },
  flowchart: {
    curve: 'basis',
    padding: 20,
    htmlLabels: true,
  },
})

// CSS to make Mermaid look like TLDraw
const TLDRAW_MERMAID_CSS = `
  .mermaid-tldraw {
    font-family: 'Shantell Sans', cursive !important;
  }

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
    fill: #fdfdfd !important;
  }

  /* Arrow/edge styling */
  .mermaid-tldraw .edgePath path.path {
    stroke-width: 1.5px !important;
    stroke: #1d1d1d !important;
  }

  /* Arrowhead styling - make it look more like TLDraw's V arrows */
  .mermaid-tldraw marker path {
    fill: none !important;
    stroke: #1d1d1d !important;
    stroke-width: 1.5px !important;
  }

  /* Diamond/rhombus shapes */
  .mermaid-tldraw .node.rhombus polygon,
  .mermaid-tldraw .node polygon {
    stroke-width: 2.5px !important;
  }

  /* Text styling */
  .mermaid-tldraw .nodeLabel,
  .mermaid-tldraw .label {
    font-size: 18px !important;
    fill: #1d1d1d !important;
    font-family: 'Shantell Sans', cursive !important;
  }

  /* Edge labels - white background to mask the line */
  .mermaid-tldraw .edgeLabel {
    font-size: 16px !important;
    font-family: 'Shantell Sans', cursive !important;
  }

  .mermaid-tldraw .edgeLabel rect {
    fill: #ffffff !important;
    stroke: #ffffff !important;
    stroke-width: 4px !important;
    opacity: 1 !important;
  }

  .mermaid-tldraw .edgeLabel span {
    color: #1d1d1d !important;
    background: transparent !important;
  }

  /* Foreign object text containers */
  .mermaid-tldraw foreignObject {
    overflow: visible !important;
  }

  .mermaid-tldraw foreignObject div {
    font-family: 'Shantell Sans', cursive !important;
  }

  /* SVG text elements */
  .mermaid-tldraw text {
    font-family: 'Shantell Sans', cursive !important;
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
  const [svgSize, setSvgSize] = useState<{ width: number; height: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const id = `mermaid-${shape.id.replace(/[^a-zA-Z0-9]/g, '')}`
        const { svg } = await mermaid.render(id, shape.props.source)
        if (!cancelled) {
          // Extract dimensions from SVG
          const parser = new DOMParser()
          const doc = parser.parseFromString(svg, 'image/svg+xml')
          const svgEl = doc.querySelector('svg')
          if (svgEl) {
            const viewBox = svgEl.getAttribute('viewBox')
            if (viewBox) {
              const [, , w, h] = viewBox.split(' ').map(Number)
              setSvgSize({ width: w, height: h })
            } else {
              const w = parseFloat(svgEl.getAttribute('width') || '400')
              const h = parseFloat(svgEl.getAttribute('height') || '300')
              setSvgSize({ width: w, height: h })
            }
          }
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

  // Calculate scale to fit
  const scale = svgSize
    ? Math.min(
        (shape.props.w - 20) / svgSize.width,
        (shape.props.h - 20) / svgSize.height,
        1 // Don't scale up beyond 1
      )
    : 1

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
          ref={containerRef}
          className="mermaid-tldraw"
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      )}
    </HTMLContainer>
  )
}
