// All note variants with pixel-accurate text zones (1x Aseprite px)
// RULE: text zone must sit entirely on the LIGHTEST shade (base color) of the note.
//   - Header stripe rows 0-14 are EXCLUDED (darker shade).
//   - Body rows 15-47 are the lightest shade.
//   - Fold/torn irregular areas are also excluded.
//   - Text zones start at y≥16 (1px padding below header boundary at row 15).

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

// ─── Zone definitions per shape (all in 1x sprite pixels) ────────────────────

// Standard flat note — full light body area
const Z_STANDARD:    TextZone = { x: 4, y: 16, w: 39, h: 27 }

// Top-right fold variants — dark triangle eats into top-right
// The fold triangle at (48,0)→(48,h)→(x,0) must be avoided.
// Conservative: reduce width to avoid fold, keep y same.
const Z_FOLD_TR_LG:  TextZone = { x: 4, y: 16, w: 26, h: 27 }  // large fold
const Z_FOLD_TR_MD:  TextZone = { x: 4, y: 16, w: 30, h: 27 }  // medium fold
const Z_FOLD_TR_SM:  TextZone = { x: 4, y: 16, w: 33, h: 27 }  // small fold

// Bottom-right fold — dark area at bottom-right corner
const Z_FOLD_BR:     TextZone = { x: 4, y: 16, w: 33, h: 20 }
const Z_FOLD_BR2:    TextZone = { x: 4, y: 16, w: 31, h: 20 }

// Both corners folded
const Z_FOLD_DUAL:   TextZone = { x: 4, y: 16, w: 28, h: 19 }

// Large top-right curl (page curl style)
const Z_CURL_TR:     TextZone = { x: 4, y: 18, w: 24, h: 22 }

// Large square fold (top-right quadrant folded)
const Z_FOLD_SQ_LG:  TextZone = { x: 4, y: 22, w: 23, h: 19 }

// Large top fold (big triangle from top-right)
const Z_FOLD_TOP_LG: TextZone = { x: 4, y: 20, w: 27, h: 21 }

// Diagonal fold variants
const Z_DIAG_TR:     TextZone = { x: 4, y: 17, w: 29, h: 24 }
const Z_DIAG_TR2:    TextZone = { x: 4, y: 18, w: 29, h: 23 }
const Z_DIAG_LG:     TextZone = { x: 4, y: 22, w: 25, h: 19 }

// Torn edges — body area reduced to avoid irregular torn pixels
const Z_TORN_BOT:    TextZone = { x: 4, y: 16, w: 39, h: 21 }  // avoid torn bottom
const Z_TORN_TOP:    TextZone = { x: 4, y: 22, w: 39, h: 21 }  // avoid torn top (push down)

// ─── Build full variant list ──────────────────────────────────────────────────
function makeVariants(num: string, zone: TextZone): NoteVariant[] {
  return [
    { key: `yellow_${num}`, file: `yellow_sticky_note_${num}.png`, color: 'yellow', zone },
    { key: `blue_${num}`,   file: `blue_sticky_note_${num}.png`,   color: 'blue',   zone },
    { key: `red_${num}`,    file: `red_sticky_note_${num}.png`,    color: 'red',    zone },
  ]
}

export const NOTE_VARIANTS: NoteVariant[] = [
  ...makeVariants('1',  Z_STANDARD),
  ...makeVariants('2',  Z_FOLD_TR_LG),
  ...makeVariants('3',  Z_FOLD_TR_MD),
  ...makeVariants('4',  Z_FOLD_TR_SM),
  ...makeVariants('5',  Z_FOLD_BR),
  ...makeVariants('6',  Z_FOLD_BR2),
  ...makeVariants('7',  Z_FOLD_DUAL),
  ...makeVariants('8',  Z_CURL_TR),
  ...makeVariants('10', Z_FOLD_SQ_LG),
  ...makeVariants('11', Z_FOLD_TOP_LG),
  ...makeVariants('12', Z_DIAG_TR),
  ...makeVariants('13', Z_DIAG_TR2),
  ...makeVariants('14', Z_DIAG_LG),
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
