// All note variants — text zones derived from actual pixel analysis of sprite alpha channels.

export interface TextZone {
  x: number
  y: number
  w: number
  h: number
}

export interface NoteVariant {
  key: string
  file: string
  color: string
  zone: TextZone
  type: 'sticky' | 'polaroid' | 'blank'
  imageArea?: { x: number; y: number; w: number; h: number }  // polaroid photo crop at 1x
}

// ─── Sticky note text zones (1x Aseprite px) ─────────────────────────────────
const Z_FULL: TextZone       = { x: 2, y: 15, w: 43, h: 33 }
const Z_TR_LG: TextZone      = { x: 2, y: 15, w: 43, h: 19 }
const Z_TR_MD: TextZone      = { x: 2, y: 15, w: 43, h: 24 }
const Z_TR_SM: TextZone      = { x: 2, y: 15, w: 43, h: 27 }
const Z_BL_LG: TextZone      = { x: 2, y: 15, w: 43, h: 19 }
const Z_BL_MD: TextZone      = { x: 2, y: 15, w: 43, h: 22 }
const Z_BL_SM: TextZone      = { x: 2, y: 15, w: 43, h: 25 }
const Z_TORN_BOT: TextZone   = { x: 2, y: 15, w: 43, h: 23 }
const Z_TORN_TOP: TextZone   = { x: 2, y: 22, w: 43, h: 24 }

// Blank note: full square with small padding — much more text room
const Z_BLANK: TextZone      = { x: 3, y: 3,  w: 42, h: 42 }

// Polaroid: caption strip at bottom (rows 37-45, 4px side margin)
const Z_POLAROID: TextZone   = { x: 5, y: 37, w: 38, h: 9 }

// Polaroid image area at 1x: the transparent "hole" inside the frame
// rows 6-35 (h=30), cols 4-43 (w=40)
const POLAROID_IMAGE_AREA = { x: 4, y: 6, w: 40, h: 30 }

// ─── Sticky note factory (yellow / blue / red / green) ───────────────────────
function makeSticky(num: string, zone: TextZone): NoteVariant[] {
  return [
    { key: `yellow_${num}`, file: `yellow_sticky_note_${num}.png`, color: 'yellow', zone, type: 'sticky' },
    { key: `blue_${num}`,   file: `blue_sticky_note_${num}.png`,   color: 'blue',   zone, type: 'sticky' },
    { key: `red_${num}`,    file: `red_sticky_note_${num}.png`,    color: 'red',    zone, type: 'sticky' },
    { key: `green_${num}`,  file: `green_sticky_note_${num}.png`,  color: 'green',  zone, type: 'sticky' },
  ]
}

// ─── Polaroid variants ────────────────────────────────────────────────────────
const POLAROID_COLORS = ['p_white', 'p_peach', 'p_mint', 'p_lime', 'p_sky', 'p_rose'] as const

const POLAROID_VARIANTS: NoteVariant[] = POLAROID_COLORS.map((color, i) => ({
  key: `polaroid_${i + 1}`,
  file: `polaroid_${i + 1}.png`,
  color,
  zone: Z_POLAROID,
  type: 'polaroid' as const,
  imageArea: POLAROID_IMAGE_AREA,
}))

// ─── Blank note variant ───────────────────────────────────────────────────────
const BLANK_VARIANTS: NoteVariant[] = [
  { key: 'blank_1', file: 'blank_note_1.png', color: 'blank', zone: Z_BLANK, type: 'blank' },
]

// ─── Full variant list ────────────────────────────────────────────────────────
export const NOTE_VARIANTS: NoteVariant[] = [
  ...makeSticky('1',  Z_FULL),
  ...makeSticky('2',  Z_TR_LG),
  ...makeSticky('3',  Z_TR_MD),
  ...makeSticky('4',  Z_TR_SM),
  ...makeSticky('5',  Z_BL_LG),
  ...makeSticky('6',  Z_BL_MD),
  ...makeSticky('7',  Z_BL_SM),
  ...makeSticky('8',  Z_FULL),
  ...makeSticky('10', Z_FULL),
  ...makeSticky('11', Z_FULL),
  ...makeSticky('12', Z_FULL),
  ...makeSticky('13', Z_FULL),
  ...makeSticky('14', Z_FULL),
  // Torn shapes — yellow / blue / red / green
  { key: 'yellow_torn',   file: 'yellow_sticky_note_torn.png',   color: 'yellow', zone: Z_TORN_BOT, type: 'sticky' },
  { key: 'yellow_torn_2', file: 'yellow_sticky_note_torn_2.png', color: 'yellow', zone: Z_TORN_TOP, type: 'sticky' },
  { key: 'blue_torn',     file: 'blue_sticky_note_torn.png',     color: 'blue',   zone: Z_TORN_BOT, type: 'sticky' },
  { key: 'blue_torn_2',   file: 'blue_sticky_note_torn_2.png',   color: 'blue',   zone: Z_TORN_TOP, type: 'sticky' },
  { key: 'red_torn',      file: 'red_sticky_note_torn.png',      color: 'red',    zone: Z_TORN_BOT, type: 'sticky' },
  { key: 'red_torn_2',    file: 'red_sticky_note_torn_2.png',    color: 'red',    zone: Z_TORN_TOP, type: 'sticky' },
  { key: 'green_torn',    file: 'green_sticky_note_torn.png',    color: 'green',  zone: Z_TORN_BOT, type: 'sticky' },
  { key: 'green_torn_2',  file: 'green_sticky_note_torn_2.png',  color: 'green',  zone: Z_TORN_TOP, type: 'sticky' },
  ...POLAROID_VARIANTS,
  ...BLANK_VARIANTS,
]

export function getVariant(key: string): NoteVariant {
  return NOTE_VARIANTS.find(v => v.key === key) || NOTE_VARIANTS[0]
}

export function getVariantsByType(type: 'sticky' | 'polaroid' | 'blank'): NoteVariant[] {
  return NOTE_VARIANTS.filter(v => v.type === type)
}
