// All note variants — text zones derived from actual pixel analysis of sprite alpha channels.
// Rule: zone covers ONLY the lightest shade (body rows 16+), stops at first fold/tear pixel.
// Zone measurements in 1x Aseprite px. All colour variants share the same shape/zone.

export interface TextZone {
  x: number
  y: number
  w: number
  h: number
}

export interface NoteVariant {
  key: string
  file: string
  color: 'yellow' | 'blue' | 'red'
  zone: TextZone
}

// ─── Pixel-confirmed zones (from row-by-row alpha scan) ─────────────────────
//
// v=1  : fully opaque, no fold → max body
// v=2  : top-right diagonal fold, R starts at row 35 → stop at row 33
// v=3  : top-right fold smaller, R starts at row 40 → stop at row 38
// v=4  : top-right fold smallest, R starts at row 43 → stop at row 41
// v=5  : bottom-left fold, L starts at row 35 → stop at row 33
// v=6  : bottom-left fold smaller, L starts ~row 38 → stop at row 36
// v=7  : bottom-left fold smallest, L starts ~row 41 → stop at row 39
// v=8–14: fully opaque body (no fold detected in body rows) → max body
// torn  : torn bottom, rows 39+ become irregular → stop at row 37
// torn_2: torn top, content rows 22–46 clean → start at row 22

// All zones use x=2 for 1px margin from sprite border.
// Width 43 = sprite width 48 − 2px left margin − 3px right margin.
// Body starts at row 15 (header = rows 0–14). Zone starts at y:15 — no gap.
// Full body height = rows 15→47 = h:33

const Z_FULL: TextZone       = { x: 2, y: 15, w: 43, h: 33 }   // no fold        (rows 15–47)
const Z_TR_LG: TextZone      = { x: 2, y: 15, w: 43, h: 19 }   // top-right fold large  (stop at row 33)
const Z_TR_MD: TextZone      = { x: 2, y: 15, w: 43, h: 24 }   // top-right fold medium (stop at row 38)
const Z_TR_SM: TextZone      = { x: 2, y: 15, w: 43, h: 27 }   // top-right fold small  (stop at row 41)
const Z_BL_LG: TextZone      = { x: 2, y: 15, w: 43, h: 19 }   // bottom-left fold large
const Z_BL_MD: TextZone      = { x: 2, y: 15, w: 43, h: 22 }   // bottom-left fold medium
const Z_BL_SM: TextZone      = { x: 2, y: 15, w: 43, h: 25 }   // bottom-left fold small
const Z_TORN_BOT: TextZone   = { x: 2, y: 15, w: 43, h: 23 }   // torn bottom    (clean to row 37)
const Z_TORN_TOP: TextZone   = { x: 2, y: 22, w: 43, h: 24 }   // torn top       (clean from row 22)

function make(num: string, zone: TextZone): NoteVariant[] {
  return [
    { key: `yellow_${num}`, file: `yellow_sticky_note_${num}.png`, color: 'yellow', zone },
    { key: `blue_${num}`,   file: `blue_sticky_note_${num}.png`,   color: 'blue',   zone },
    { key: `red_${num}`,    file: `red_sticky_note_${num}.png`,    color: 'red',    zone },
  ]
}

export const NOTE_VARIANTS: NoteVariant[] = [
  ...make('1',  Z_FULL),
  ...make('2',  Z_TR_LG),
  ...make('3',  Z_TR_MD),
  ...make('4',  Z_TR_SM),
  ...make('5',  Z_BL_LG),
  ...make('6',  Z_BL_MD),
  ...make('7',  Z_BL_SM),
  ...make('8',  Z_FULL),
  ...make('10', Z_FULL),
  ...make('11', Z_FULL),
  ...make('12', Z_FULL),
  ...make('13', Z_FULL),
  ...make('14', Z_FULL),
  { key: 'yellow_torn',   file: 'yellow_sticky_note_torn.png',   color: 'yellow', zone: Z_TORN_BOT },
  { key: 'yellow_torn_2', file: 'yellow_sticky_note_torn_2.png', color: 'yellow', zone: Z_TORN_TOP },
  { key: 'blue_torn',     file: 'blue_sticky_note_torn.png',     color: 'blue',   zone: Z_TORN_BOT },
  { key: 'blue_torn_2',   file: 'blue_sticky_note_torn_2.png',   color: 'blue',   zone: Z_TORN_TOP },
  { key: 'red_torn',      file: 'red_sticky_note_torn.png',      color: 'red',    zone: Z_TORN_BOT },
  { key: 'red_torn_2',    file: 'red_sticky_note_torn_2.png',    color: 'red',    zone: Z_TORN_TOP },
]

export function getVariant(key: string): NoteVariant {
  return NOTE_VARIANTS.find(v => v.key === key) || NOTE_VARIANTS[0]
}
