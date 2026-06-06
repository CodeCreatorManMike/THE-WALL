import type { ShadowMask } from './assets'
import { SHADOW_MAP, NOTE_BASE_COLORS, NOTE_HEADER_COLORS, COLOR_WALL_BG } from './constants'
import type { NoteData } from './types'

// ─── Color helpers ────────────────────────────────────────────────────────────
function getShadowColor(hex: string): string {
  const h = hex.toLowerCase()
  if (SHADOW_MAP[h]) return SHADOW_MAP[h]
  for (const [key, val] of Object.entries(SHADOW_MAP)) {
    if (colorDist(h, key) < 15) return val
  }
  return darkenHex(h, 30)
}

function colorDist(a: string, b: string): number {
  try {
    const [r1, g1, b1] = hexToRgb(a)
    const [r2, g2, b2] = hexToRgb(b)
    return Math.abs(r1-r2) + Math.abs(g1-g2) + Math.abs(b1-b2)
  } catch { return 999 }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function darkenHex(hex: string, amt: number): string {
  try {
    const [r, g, b] = hexToRgb(hex)
    return `#${[r, g, b].map(c => Math.max(0, c-amt).toString(16).padStart(2,'0')).join('')}`
  } catch { return '#555' }
}

function getSurfaceColor(px: number, py: number, notes: NoteData[], scale: number): string {
  const sorted = [...notes].sort((a, b) => b.zIndex - a.zIndex)
  for (const note of sorted) {
    const sx = note.screenX, sy = note.screenY
    const sw = 48 * scale, sh = 48 * scale
    if (px >= sx && px < sx+sw && py >= sy && py < sy+sh) {
      const localY = (py - sy) / scale
      return localY < 15
        ? NOTE_HEADER_COLORS[note.color] || COLOR_WALL_BG
        : NOTE_BASE_COLORS[note.color]  || COLOR_WALL_BG
    }
  }
  return COLOR_WALL_BG
}

// ─── Pixel-accurate shadow using precomputed mask ─────────────────────────────
// Draws 1px left + 1px below following the actual sprite edges, not the bounding box.
export function drawNoteShadow(
  ctx: CanvasRenderingContext2D,
  note: NoteData,
  mask: ShadowMask,
  allNotes: NoteData[],
  scale: number
) {
  const sx = note.screenX
  const sy = note.screenY
  const le = mask.leftEdge
  const be = mask.bottomEdge

  // Left-edge shadow pixels
  for (let i = 0; i < le.length; i += 2) {
    const px = sx + le[i]   * scale
    const py = sy + le[i+1] * scale
    const surface = getSurfaceColor(px, py, allNotes, scale)
    ctx.fillStyle = getShadowColor(surface)
    ctx.fillRect(px, py, scale, scale)
  }

  // Bottom-edge shadow pixels
  for (let i = 0; i < be.length; i += 2) {
    const px = sx + be[i]   * scale
    const py = sy + be[i+1] * scale
    const surface = getSurfaceColor(px, py, allNotes, scale)
    ctx.fillStyle = getShadowColor(surface)
    ctx.fillRect(px, py, scale, scale)
  }
}

// ─── Simple UI shadow (edit screen — shadow on white for note preview only) ───
export function drawUIShadow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color = '#dae0ea'
) {
  ctx.fillStyle = color
  ctx.fillRect(x - 1, y, 1, h)          // left column
  ctx.fillRect(x - 1, y + h, w, 1)      // bottom row (incl. bottom-left corner)
}
