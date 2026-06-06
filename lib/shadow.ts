import { SHADOW_MAP, NOTE_BASE_COLORS, NOTE_HEADER_COLORS, COLOR_WALL_BG } from './constants'
import type { NoteData } from './types'

function getShadowColor(hex: string): string {
  const h = hex.toLowerCase()
  if (SHADOW_MAP[h]) return SHADOW_MAP[h]
  // tolerance match
  for (const [key, val] of Object.entries(SHADOW_MAP)) {
    if (colorDist(h, key) < 12) return val
  }
  return darkenHex(h, 30)
}

function colorDist(a: string, b: string): number {
  try {
    const [r1, g1, b1] = hexToRgb(a)
    const [r2, g2, b2] = hexToRgb(b)
    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
  } catch {
    return 999
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function darkenHex(hex: string, amt: number): string {
  try {
    const [r, g, b] = hexToRgb(hex)
    const clamp = (v: number) => Math.max(0, Math.min(255, v))
    return `#${[r, g, b].map(c => clamp(c - amt).toString(16).padStart(2, '0')).join('')}`
  } catch {
    return '#666'
  }
}

function getSurfaceColor(px: number, py: number, notes: NoteData[], scale: number): string {
  // Check topmost note whose bounds contain this pixel
  const sorted = [...notes].sort((a, b) => b.zIndex - a.zIndex)
  for (const note of sorted) {
    const sx = note.screenX
    const sy = note.screenY
    const sw = 48 * scale
    const sh = 48 * scale
    if (px >= sx && px < sx + sw && py >= sy && py < sy + sh) {
      const localY = (py - sy) / scale
      return localY < 15
        ? NOTE_HEADER_COLORS[note.color] || COLOR_WALL_BG
        : NOTE_BASE_COLORS[note.color] || COLOR_WALL_BG
    }
  }
  return COLOR_WALL_BG
}

export function drawNoteShadow(
  ctx: CanvasRenderingContext2D,
  note: NoteData,
  allNotes: NoteData[],
  scale: number
) {
  const sx = note.screenX
  const sy = note.screenY
  const sw = 48 * scale
  const sh = 48 * scale

  // Left column: x=sx-1, y from sy to sy+sh-1
  for (let py = sy; py < sy + sh; py++) {
    const surface = getSurfaceColor(sx - 1, py, allNotes, scale)
    ctx.fillStyle = getShadowColor(surface)
    ctx.fillRect(sx - 1, py, 1, 1)
  }

  // Bottom row: y=sy+sh, x from sx-1 to sx+sw-1
  for (let px = sx - 1; px < sx + sw; px++) {
    const surface = getSurfaceColor(px, sy + sh, allNotes, scale)
    ctx.fillStyle = getShadowColor(surface)
    ctx.fillRect(px, sy + sh, 1, 1)
  }
}

// Simplified shadow for UI/edit screen (fixed #dae0ea on white)
export function drawUIShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string = '#dae0ea'
) {
  ctx.fillStyle = color
  // Left column
  ctx.fillRect(x - 1, y, 1, h)
  // Bottom row (including bottom-left corner)
  ctx.fillRect(x - 1, y + h, w, 1)
}
