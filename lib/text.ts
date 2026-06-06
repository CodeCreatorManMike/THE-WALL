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

// Font NEVER shrinks. Always FONT_MAX (8px at 1x).
// Text fills the zone at fixed size and simply STOPS when the zone is full.
// posScale: scale for zone coordinates on the displayed note
// fontScale: scale for font size (defaults to posScale; pass getScale() for edit preview)
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
  const fontSize = FONT_MAX * fs   // FIXED — never shrinks

  // Zone positioned using posScale (correct relative to displayed note size)
  const baseX    = noteX + zone.x * posScale
  const baseY    = noteY + zone.y * posScale
  const zoneW    = zone.w * posScale
  const zoneH    = zone.h * posScale
  const maxBottom = baseY + zoneH

  // Character metrics at the fixed font size
  const charW  = (Math.ceil(FONT_MAX * 0.6) + 1) * fs
  const lineH  = (FONT_MAX + 2) * fs
  const perLine = Math.max(1, Math.floor(zoneW / charW))

  const lines = wrapText(text, perLine)

  ctx.save()
  ctx.font = `${fontSize}px minecraft`
  ctx.fillStyle = TEXT_COLORS[color] || '#1a1008'
  ctx.textBaseline = 'top'
  ctx.imageSmoothingEnabled = false

  // Clip strictly to zone — text stops at the zone border, never overflows
  ctx.beginPath()
  ctx.rect(baseX, baseY, zoneW, zoneH)
  ctx.clip()

  for (let i = 0; i < lines.length; i++) {
    const drawY = baseY + i * lineH
    if (drawY >= maxBottom) break          // stop — zone is full vertically
    ctx.fillText(lines[i], baseX, drawY)
  }

  ctx.restore()
}
