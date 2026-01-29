import { useState, useEffect } from 'react'
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
    primaryColor: '#f9f9f9',
    primaryTextColor: '#1d1d1d',
    primaryBorderColor: '#1d1d1d',
    lineColor: '#1d1d1d',
    textColor: '#1d1d1d',
    mainBkg: '#f9f9f9',
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

// TLDraw arrow parameters
const ARROW_HEAD_LENGTH = 12  // Length of arrowhead lines
const ARROW_HEAD_ANGLE = 25  // Angle in degrees
const MIN_ARROW_HEAD_LENGTH = 6  // Minimum when arrows are short

// CSS to make Mermaid look like TLDraw
const TLDRAW_MERMAID_CSS = `
  .mermaid-tldraw {
    font-family: 'Shantell Sans', cursive !important;
  }

  .mermaid-tldraw * {
    font-family: 'Shantell Sans', cursive !important;
  }

  /* Thicker strokes like TLDraw */
  .mermaid-tldraw .node rect {
    stroke-width: 3.5px !important;
    stroke: #1d1d1d !important;
    fill: #f9f9f9 !important;
    rx: 12px !important;
    ry: 12px !important;
  }

  .mermaid-tldraw .node circle,
  .mermaid-tldraw .node ellipse {
    stroke-width: 3.5px !important;
    stroke: #1d1d1d !important;
    fill: #f9f9f9 !important;
  }

  .mermaid-tldraw .node polygon,
  .mermaid-tldraw .node path {
    stroke-width: 3.5px !important;
    stroke: #1d1d1d !important;
    fill: #f9f9f9 !important;
  }

  /* Arrow/edge styling */
  .mermaid-tldraw .edgePath path.path {
    stroke-width: 2px !important;
    stroke: #1d1d1d !important;
  }


  /* Diamond/rhombus shapes */
  .mermaid-tldraw .node.rhombus polygon,
  .mermaid-tldraw .node polygon {
    stroke-width: 3.5px !important;
  }

  /* Text styling - bolder */
  .mermaid-tldraw .nodeLabel,
  .mermaid-tldraw .label {
    font-size: 20px !important;
    font-weight: 500 !important;
    fill: #1d1d1d !important;
    font-family: 'Shantell Sans', cursive !important;
  }

  /* Edge labels - white background to mask the line */
  .mermaid-tldraw .edgeLabel {
    font-size: 16px !important;
    font-weight: 500 !important;
    font-family: 'Shantell Sans', cursive !important;
  }

  .mermaid-tldraw .edgeLabel rect {
    fill: #ffffff !important;
    stroke: #ffffff !important;
    stroke-width: 6px !important;
    opacity: 1 !important;
  }

  .mermaid-tldraw .edgeLabel span {
    color: #1d1d1d !important;
    background: transparent !important;
    font-weight: 500 !important;
  }

  /* Foreign object text containers */
  .mermaid-tldraw foreignObject {
    overflow: visible !important;
  }

  .mermaid-tldraw foreignObject div {
    font-family: 'Shantell Sans', cursive !important;
    font-weight: 500 !important;
  }

  /* SVG text elements */
  .mermaid-tldraw text {
    font-family: 'Shantell Sans', cursive !important;
    font-weight: 500 !important;
  }

  /* Custom V arrowheads */
  .mermaid-tldraw .tldraw-arrowhead {
    stroke: #1d1d1d !important;
    stroke-width: 2px !important;
    fill: none !important;
    stroke-linecap: round !important;
    stroke-linejoin: round !important;
  }

  /* Hide any remaining Mermaid markers/arrowheads */
  .mermaid-tldraw marker,
  .mermaid-tldraw defs marker {
    display: none !important;
  }

  /* Remove marker references via CSS */
  .mermaid-tldraw .edgePath path {
    marker-end: none !important;
    marker-start: none !important;
  }
`

/**
 * Post-process Mermaid SVG to add TLDraw-style V arrowheads
 */
function postProcessSvg(svgString: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) {
    return svgString
  }

  // Remove ALL marker definitions - check in defs and anywhere else
  const defs = svg.querySelectorAll('defs')
  defs.forEach(def => {
    const markers = def.querySelectorAll('marker')
    markers.forEach(m => m.remove())
    // If defs is now empty, remove it too
    if (def.children.length === 0) {
      def.remove()
    }
  })

  // Also remove any markers not in defs
  const standaloneMarkers = svg.querySelectorAll('marker')
  standaloneMarkers.forEach(m => m.remove())

  // Get ALL edge paths - the .edgePath elements contain the arrow paths
  const edgePathGroups = svg.querySelectorAll('.edgePath')

  edgePathGroups.forEach((group) => {
    // Find all paths in this edge group
    const paths = group.querySelectorAll('path')

    paths.forEach(path => {
      // Remove ALL marker-related attributes
      path.removeAttribute('marker-end')
      path.removeAttribute('marker-start')
      path.removeAttribute('marker-mid')

      // Clean style attribute
      const style = path.getAttribute('style')
      if (style) {
        const cleanedStyle = style
          .replace(/marker-end\s*:\s*[^;]+;?/gi, '')
          .replace(/marker-start\s*:\s*[^;]+;?/gi, '')
          .replace(/marker-mid\s*:\s*[^;]+;?/gi, '')
        path.setAttribute('style', cleanedStyle)
      }
    })

    // Get the main path (usually the one with a 'd' attribute that's not just a point)
    const mainPath = Array.from(paths).find(p => {
      const d = p.getAttribute('d')
      return d && d.length > 10 // Has a real path, not just a marker
    })

    if (!mainPath) return

    const d = mainPath.getAttribute('d')
    if (!d) return

    // Parse the path to get the end point and direction
    const endPoint = getPathEndPoint(d)
    const direction = getPathEndDirection(d)

    if (!endPoint || !direction) return

    // Calculate arrowhead size based on path length
    const pathLength = estimatePathLength(d)
    const headLength = Math.max(
      MIN_ARROW_HEAD_LENGTH,
      Math.min(ARROW_HEAD_LENGTH, pathLength * 0.15)
    )

    // Create V arrowhead
    const arrowhead = createVArrowhead(endPoint, direction, headLength)

    // Add arrowhead path - append to svg root so it's on top
    const arrowPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
    arrowPath.setAttribute('d', arrowhead)
    arrowPath.setAttribute('class', 'tldraw-arrowhead')
    arrowPath.setAttribute('stroke', '#1d1d1d')
    arrowPath.setAttribute('stroke-width', '2')
    arrowPath.setAttribute('fill', 'none')
    arrowPath.setAttribute('stroke-linecap', 'round')
    arrowPath.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(arrowPath)
  })

  return new XMLSerializer().serializeToString(doc)
}

/**
 * Get the end point of an SVG path
 */
function getPathEndPoint(d: string): { x: number; y: number } | null {
  // Parse path commands - handle M, L, C, Q, etc.
  const commands = d.match(/[MLCQAZ][^MLCQAZ]*/gi)
  if (!commands || commands.length === 0) return null

  const lastCmd = commands[commands.length - 1].trim()
  const nums = lastCmd.slice(1).trim().split(/[\s,]+/).map(Number)

  if (lastCmd[0].toUpperCase() === 'Z') {
    // Closed path - get from previous command
    if (commands.length < 2) return null
    const prevCmd = commands[commands.length - 2].trim()
    const prevNums = prevCmd.slice(1).trim().split(/[\s,]+/).map(Number)
    return { x: prevNums[prevNums.length - 2], y: prevNums[prevNums.length - 1] }
  }

  // For C (cubic bezier), last 2 numbers are the end point
  // For L, M, last 2 numbers are the point
  if (nums.length >= 2) {
    return { x: nums[nums.length - 2], y: nums[nums.length - 1] }
  }

  return null
}

/**
 * Get the direction vector at the end of an SVG path
 */
function getPathEndDirection(d: string): { x: number; y: number } | null {
  const commands = d.match(/[MLCQAZ][^MLCQAZ]*/gi)
  if (!commands || commands.length === 0) return null

  // Get last non-Z command
  let lastCmd = commands[commands.length - 1].trim()
  if (lastCmd[0].toUpperCase() === 'Z' && commands.length >= 2) {
    lastCmd = commands[commands.length - 2].trim()
  }

  const cmdType = lastCmd[0].toUpperCase()
  const nums = lastCmd.slice(1).trim().split(/[\s,]+/).map(Number)

  let fromX: number, fromY: number, toX: number, toY: number

  if (cmdType === 'C' && nums.length >= 6) {
    // Cubic bezier: C x1 y1, x2 y2, x y
    // Direction is from control point 2 to end point
    fromX = nums[nums.length - 4]
    fromY = nums[nums.length - 3]
    toX = nums[nums.length - 2]
    toY = nums[nums.length - 1]
  } else if (cmdType === 'Q' && nums.length >= 4) {
    // Quadratic bezier: Q x1 y1, x y
    fromX = nums[0]
    fromY = nums[1]
    toX = nums[2]
    toY = nums[3]
  } else if (cmdType === 'L' && nums.length >= 2) {
    // Line - need previous point
    const prevEndPoint = getPreviousEndPoint(commands, commands.length - 1)
    if (!prevEndPoint) return null
    fromX = prevEndPoint.x
    fromY = prevEndPoint.y
    toX = nums[0]
    toY = nums[1]
  } else {
    // Default: try to get direction from last two points
    const prevEndPoint = getPreviousEndPoint(commands, commands.length - 1)
    if (!prevEndPoint || nums.length < 2) return null
    fromX = prevEndPoint.x
    fromY = prevEndPoint.y
    toX = nums[nums.length - 2]
    toY = nums[nums.length - 1]
  }

  const dx = toX - fromX
  const dy = toY - fromY
  const len = Math.sqrt(dx * dx + dy * dy)

  if (len === 0) return { x: 0, y: 1 } // Default down

  return { x: dx / len, y: dy / len }
}

/**
 * Get the end point of a previous command
 */
function getPreviousEndPoint(commands: RegExpMatchArray, currentIndex: number): { x: number; y: number } | null {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const cmd = commands[i].trim()
    if (cmd[0].toUpperCase() === 'Z') continue

    const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number)
    if (nums.length >= 2) {
      return { x: nums[nums.length - 2], y: nums[nums.length - 1] }
    }
  }
  return null
}

/**
 * Estimate the length of an SVG path (rough approximation)
 */
function estimatePathLength(d: string): number {
  const commands = d.match(/[MLCQAZ][^MLCQAZ]*/gi)
  if (!commands) return 100

  let length = 0
  let lastPoint: { x: number; y: number } | null = null

  for (const cmd of commands) {
    const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number)
    if (nums.length >= 2) {
      const point = { x: nums[nums.length - 2], y: nums[nums.length - 1] }
      if (lastPoint) {
        length += Math.sqrt(
          Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
        )
      }
      lastPoint = point
    }
  }

  return length
}

/**
 * Create a TLDraw-style V arrowhead path
 */
function createVArrowhead(
  tip: { x: number; y: number },
  direction: { x: number; y: number },
  length: number
): string {
  const angleRad = (ARROW_HEAD_ANGLE * Math.PI) / 180

  // Rotate direction vector by +/- angle to get the two arrowhead lines
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)

  // Left line (rotate direction by +angle, then go backwards)
  const leftX = tip.x - length * (direction.x * cos - direction.y * sin)
  const leftY = tip.y - length * (direction.x * sin + direction.y * cos)

  // Right line (rotate direction by -angle, then go backwards)
  const rightX = tip.x - length * (direction.x * cos + direction.y * sin)
  const rightY = tip.y - length * (-direction.x * sin + direction.y * cos)

  return `M ${leftX} ${leftY} L ${tip.x} ${tip.y} L ${rightX} ${rightY}`
}

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

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const id = `mermaid-${shape.id.replace(/[^a-zA-Z0-9]/g, '')}`
        const { svg: rawSvg } = await mermaid.render(id, shape.props.source)

        if (!cancelled) {
          // Post-process SVG to add TLDraw-style arrowheads
          const processedSvg = postProcessSvg(rawSvg)

          // Extract dimensions from SVG
          const parser = new DOMParser()
          const doc = parser.parseFromString(processedSvg, 'image/svg+xml')
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
          setSvg(processedSvg)
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
