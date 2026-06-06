import type { TextZone } from './variants'
import { FONT_MAX, TEXT_COLORS } from './constants'

// Pixel-accurate character-by-character wrapping using actual measured widths.
// Much more accurate than estimating from a single character.
function wrapByMeasure(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

// Font never shrinks. Always FONT_MAX (8px at 1x).
// posScale: scale for zone positioning on the displayed note
// fontScale: scale for font rendering (pass getScale() in edit preview)
export function renderNoteText(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  zone: TextZone,
  noteX: number,
  noteY: number,
  posScale: number,
  fontScale?: number
) {
  if (!text) return

  const fs = fontScale ?? posScale
  const fontSize = FONT_MAX * fs

  const baseX    = noteX + zone.x * posScale
  const baseY    = noteY + zone.y * posScale
  const zoneW    = zone.w * posScale
  const zoneH    = zone.h * posScale
  const maxBottom = baseY + zoneH

  ctx.save()
  ctx.font = `${fontSize}px minecraft`
  ctx.fillStyle = TEXT_COLORS[color] || '#1a1008'
  ctx.textBaseline = 'top'
  ctx.imageSmoothingEnabled = false

  // Pixel-accurate wrapping: measure each character as it's added to the line
  const lines = wrapByMeasure(ctx, text, zoneW)
  const lineH  = FONT_MAX * fs

  // Clip strictly to zone — text stops at zone boundary
  ctx.beginPath()
  ctx.rect(baseX, baseY, zoneW, zoneH)
  ctx.clip()

  for (let i = 0; i < lines.length; i++) {
    const drawY = baseY + i * lineH
    if (drawY >= maxBottom) break
    ctx.fillText(lines[i], baseX, drawY)
  }

  ctx.restore()
}
