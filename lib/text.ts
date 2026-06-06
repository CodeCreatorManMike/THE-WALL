import type { TextZone } from './variants'
import { FONT_MAX, TEXT_COLORS } from './constants'

export function wrapText(text: string, perLine: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    if (current.length >= perLine) {
      lines.push(current)
      current = char
    } else {
      current += char
    }
  }
  if (current) lines.push(current)
  return lines
}

// Font never shrinks. Always FONT_MAX (8px at 1x).
// Uses ctx.measureText for pixel-accurate line width — no estimation.
// posScale: zone positioning on the displayed note
// fontScale: font render size (pass getScale() in edit preview)
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

  // Measure actual character width from the loaded font (Minecraft is monospace)
  // This is accurate — no estimation, fills the zone correctly
  const actualCharW = ctx.measureText('M').width || fontSize * 0.5
  const lineH       = (FONT_MAX + 2) * fs
  const perLine     = Math.max(1, Math.floor(zoneW / actualCharW))
  const lines       = wrapText(text, perLine)

  // Clip strictly to zone
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
