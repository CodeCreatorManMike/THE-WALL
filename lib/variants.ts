// All note variants with their text zones (1x Aseprite px)
// Text zones are conservative rectangles that avoid ALL dark fold/tear areas

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

// Zone definitions per shape type
// Shape 1  — standard flat
const Z_STANDARD: TextZone = { x: 4, y: 13, w: 40, h: 31 }
// Shape 2  — large top-right fold (cuts deeply into top-right)
const Z_FOLD_TR_LG: TextZone = { x: 4, y: 20, w: 28, h: 24 }
// Shape 3  — medium top-right fold
const Z_FOLD_TR_MD: TextZone = { x: 4, y: 16, w: 32, h: 28 }
// Shape 4  — top-right fold + slight bottom variation
const Z_FOLD_TR_SM: TextZone = { x: 4, y: 16, w: 34, h: 26 }
// Shape 5  — bottom-right corner fold (white curl)
const Z_FOLD_BR: TextZone = { x: 4, y: 13, w: 34, h: 24 }
// Shape 6  — bottom-right fold variant
const Z_FOLD_BR2: TextZone = { x: 4, y: 13, w: 32, h: 24 }
// Shape 7  — both corners folded (top-right + bottom-right)
const Z_FOLD_DUAL: TextZone = { x: 4, y: 18, w: 30, h: 20 }
// Shape 8  — large top-right page curl
const Z_CURL_TR: TextZone = { x: 4, y: 20, w: 26, h: 22 }
// Shape 10 — large top-right square fold
const Z_FOLD_SQ_LG: TextZone = { x: 4, y: 22, w: 24, h: 20 }
// Shape 11 — large top fold (triangle going deep)
const Z_FOLD_TOP_LG: TextZone = { x: 4, y: 20, w: 28, h: 22 }
// Shape 12 — diagonal top-right
const Z_DIAG_TR: TextZone = { x: 4, y: 17, w: 30, h: 25 }
// Shape 13 — diagonal variant
const Z_DIAG_TR2: TextZone = { x: 4, y: 18, w: 30, h: 24 }
// Shape 14 — largest diagonal fold
const Z_DIAG_LG: TextZone = { x: 4, y: 22, w: 26, h: 20 }
// TORN — torn bottom edge
const Z_TORN_BOT: TextZone = { x: 4, y: 13, w: 40, h: 23 }
// TORN 2 — torn top edge
const Z_TORN_TOP: TextZone = { x: 4, y: 19, w: 40, h: 25 }

// Build full variant list: each shape × 3 colours
function makeVariants(
  num: string,
  zone: TextZone
): NoteVariant[] {
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
