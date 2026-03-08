import type { Editor } from 'tldraw'
import {
  TEXT_PROPS,
  LABEL_FONT_SIZES,
  FONT_FAMILIES,
} from 'tldraw'

// LABEL_PADDING is @internal in tldraw, so we hardcode it
const LABEL_PADDING = 16

type SizeStyle = 's' | 'm' | 'l' | 'xl'
type FontStyle = 'draw' | 'sans' | 'serif' | 'mono'

export interface MeasureTextOptions {
  size?: SizeStyle
  font?: FontStyle
  maxWidth?: number | null
  padding?: number
}

/**
 * Measure text as tldraw would render it inside a geo shape label.
 * Returns { w, h } including label padding.
 */
export function measureShapeText(
  editor: Editor,
  text: string,
  options: MeasureTextOptions = {}
): { w: number; h: number } {
  const { size = 'm', font = 'draw', maxWidth = null, padding = LABEL_PADDING } = options

  const fontSize = LABEL_FONT_SIZES[size]
  const fontFamily = FONT_FAMILIES[font]

  const measured = editor.textMeasure.measureText(text, {
    ...TEXT_PROPS,
    fontSize,
    fontFamily,
    maxWidth,
    padding: '0px',
  })

  return {
    w: measured.w + padding * 2,
    h: measured.h + padding * 2,
  }
}
