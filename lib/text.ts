import type { TextZone } from './variants'
import { FONT_MAX, FONT_MIN, TEXT_COLORS } from './constants'

export function calcFontSize(text: string, zone: TextZone): number {
  let size = FONT_MAX
  while (size >= FONT_MIN) {
    const charW = Math.ceil(size * 0.6) + 1
    const lineH = size + 2
    const perLine = Math.floor(zone.w / charW)
    const maxLines = Math.floor(zone.h / lineH)
    if (text.length <= perLine * maxLines) return size
    size--
  }
  return FONT_MIN
}

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

// posScale: used for zone coordinates (where text zone sits on the note sprite)
// fontScale: used for font size rendering (defaults to posScale)
// This lets edit preview position text correctly on a large note while keeping
// font at pixel-art size (getScale()), avoiding blown-up text
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
  const fontSize = calcFontSize(text, zone) * fs

  // Zone positioning uses posScale (correct for the displayed note size)
  const baseX = noteX + zone.x * posScale
  const baseY = noteY + zone.y * posScale
  const zoneW = zone.w * posScale
  const zoneH = zone.h * posScale
  const maxBottom = baseY + zoneH

  // Wrap based on zone width at posScale, with font at fs
  const charW = (Math.ceil((fontSize / fs) * 0.6) + 1) * fs
  const lineH = (fontSize / fs + 2) * fs
  const perLine = Math.max(1, Math.floor(zoneW / charW))
  const lines = wrapText(text, perLine)

  ctx.save()
  ctx.font = `${fontSize}px minecraft`
  ctx.fillStyle = TEXT_COLORS[color] || '#1a1008'
  ctx.textBaseline = 'top'
  ctx.imageSmoothingEnabled = false

  lines.forEach((line, i) => {
    const drawY = baseY + i * lineH
    if (drawY + fontSize <= maxBottom) {
      ctx.fillText(line, baseX, drawY)
    }
  })

  ctx.restore()
}
