# Native Shapes Text Scaling Issue

## Problem

The native TLDraw sequence diagram rendering produces larger diagrams than Mermaid's SVG output due to text size differences. TLDraw's smallest text size (`size: 's'`) is still larger than what Mermaid uses, causing the overall layout to be more spread out.

## Current Architecture

The native conversion pipeline is completely independent of Mermaid's rendering:

```
Mermaid Text → Parser → Semantic Data → Layout Engine → TLDraw Shapes
                         (types.ts)     (layout.ts)     (converter.ts)
```

### Key Files
- `packages/mermaid-to-tldraw/src/parser.ts` - Parses Mermaid syntax into semantic data
- `packages/mermaid-to-tldraw/src/layout.ts` - Positions elements using hardcoded constants
- `packages/mermaid-to-tldraw/src/converter.ts` - Creates TLDraw shapes

### Current Layout Constants (layout.ts)
```typescript
const SEQ_PARTICIPANT_WIDTH = 120
const SEQ_PARTICIPANT_HEIGHT = 50
const SEQ_PARTICIPANT_GAP = 80
const SEQ_MESSAGE_HEIGHT = 50
const SEQ_NOTE_WIDTH = 150
const SEQ_NOTE_HEIGHT = 40
```

## Investigation: TLDraw Scale Property

TLDraw shapes have a `scale` property in their schema:
- `TLTextShape.props.scale: number`
- `TLGeoShape.props.scale: number`

**Finding**: The `scale` property appears to be **read-only/computed**. Setting it programmatically via `createShape()` or `updateShape()` has no effect. It only changes when users manually resize shapes via drag handles.

### Test Results
```typescript
// These have NO effect:
editor.createShape({
  type: 'geo',
  props: { scale: 0.3, ... }
})

editor.updateShape({
  id: shapeId,
  props: { scale: 0.3 }
})
```

## Potential Solutions

### Option 1: Reduce Layout Constants
Shrink the hardcoded spacing values to create more compact diagrams.

**Pros**: Simple, immediate improvement
**Cons**: Still won't match Mermaid exactly; text will overflow boxes

### Option 2: Parse Mermaid SVG Output
Extract actual positions from Mermaid's rendered SVG and use those coordinates.

**Pros**: Perfect match with Mermaid layout
**Cons**: Complex implementation; ties native shapes to Mermaid's rendering

### Option 3: Custom Font Size Configuration
Investigate TLDraw's `FONT_SIZES` configuration or custom shape utils to define smaller text sizes.

**Pros**: Addresses root cause
**Cons**: May require forking TLDraw components

### Option 4: CSS Transform Scaling
Apply CSS transforms to scale down the entire diagram group after creation.

**Pros**: Works around TLDraw limitations
**Cons**: Hacky; may affect interactivity

### Option 5: Custom Text Shape Util
Create a custom `SmallTextShapeUtil` that renders text at smaller sizes.

**Pros**: Full control over text rendering
**Cons**: Significant implementation effort

## Recommended Next Steps

1. **Short-term**: Reduce layout constants for more compact diagrams
2. **Medium-term**: Research TLDraw's font size customization options
3. **Long-term**: Consider Option 2 (SVG parsing) for pixel-perfect matching

## References

- [TLDraw TextShapeUtil](https://tldraw.dev/reference/tldraw/TextShapeUtil)
- [TLDraw GeoShapeProps](https://tldraw.dev/reference/tlschema/TLGeoShapeProps)
- [TLDraw Custom Font Sizes](https://tldraw.dev/examples/custom-stroke-and-font-sizes)
