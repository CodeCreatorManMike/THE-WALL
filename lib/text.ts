import type { TextZone } from './variants'
import { FONT_MAX, TEXT_COLORS } from './constants'

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

// posScale: scale for zone positioning
// fontScale: scale for font size
// centered: center each line within the zone (used for polaroid captions)
export function renderNoteText(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  zone: TextZone,
  noteX: number,
  noteY: number,
  posScale: number,
  fontScale?: number,
  centered = false
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

  const lines = wrapByMeasure(ctx, text, zoneW)
  const lineH  = FONT_MAX * fs

  ctx.beginPath()
  ctx.rect(baseX, baseY, zoneW, zoneH)
  ctx.clip()

  if (centered) {
    ctx.textAlign = 'center'
    const centerX = baseX + zoneW / 2
    for (let i = 0; i < lines.length; i++) {
      const drawY = baseY + i * lineH
      if (drawY >= maxBottom) break
      ctx.fillText(lines[i], centerX, drawY)
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      const drawY = baseY + i * lineH
      if (drawY >= maxBottom) break
      ctx.fillText(lines[i], baseX, drawY)
    }
  }

  ctx.restore()
}
