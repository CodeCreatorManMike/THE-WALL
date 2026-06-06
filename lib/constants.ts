// ─── Scale ───────────────────────────────────────────────────────────────────
export function getScale(): number {
  return window.innerWidth < 480 ? 3 : 2
}

// ─── World ────────────────────────────────────────────────────────────────────
export const WORLD_SIZE = 10000
export const CANVAS_W = 240   // 1x Aseprite units
export const CANVAS_H = 196

// ─── Colours ──────────────────────────────────────────────────────────────────
export const COLOR_WALL_BG = '#8b93af'
export const COLOR_WALL_SHADOW = '#6b7390'
export const COLOR_UI_BG = '#ffffff'
export const COLOR_UI_SHADOW = '#dae0ea'
export const COLOR_UI_SHADOW2 = '#bec8d4'

export const NOTE_BASE_COLORS: Record<string, string> = {
  // Sticky notes
  yellow: '#ffd860',
  blue:   '#a1d5e6',
  red:    '#ef462e',
  green:  '#eeffcc',
  // Polaroids (light shade = main body / bottom strip)
  p_white: '#ffffff',
  p_peach: '#ffe9e3',
  p_mint:  '#b5e7cb',
  p_lime:  '#f0ef84',
  p_sky:   '#88d3eb',
  p_rose:  '#e27285',
  // Blank note
  blank:   '#ffffff',
}

export const NOTE_HEADER_COLORS: Record<string, string> = {
  // Sticky notes
  yellow: '#f7b23b',
  blue:   '#82b5d9',
  red:    '#f01b0f',
  green:  '#bedc7f',
  // Polaroids (medium shade = frame/border color)
  p_white: '#dae0ea',
  p_peach: '#d7bcb4',
  p_mint:  '#77b994',
  p_lime:  '#cdcc70',
  p_sky:   '#42bfe8',
  p_rose:  '#b25266',
  // Blank note
  blank:   '#dae0ea',
}

export const TEXT_COLORS: Record<string, string> = {
  yellow:  '#1a1008',
  blue:    '#0d1a24',
  red:     '#ffffff',
  green:   '#1a1008',
  p_white: '#1a1008',
  p_peach: '#1a1008',
  p_mint:  '#1a1008',
  p_lime:  '#1a1008',
  p_sky:   '#1a1008',
  p_rose:  '#1a1008',
  blank:   '#1a1008',
}

export const SHADOW_MAP: Record<string, string> = {
  // Yellow sticky
  '#ffd860': '#f7b23b',
  '#f7b23b': '#cf9634',
  '#cf9634': '#aa761b',
  '#aa761b': '#aa761b',
  // Blue sticky
  '#a1d5e6': '#82b5d9',
  '#82b5d9': '#6699cc',
  '#6699cc': '#3d6d9d',
  '#3d6d9d': '#3d6d9d',
  // Red sticky
  '#ef462e': '#f01b0f',
  '#f01b0f': '#6c0e00',
  '#6c0e00': '#480900',
  '#480900': '#480900',
  // Green sticky
  '#eeffcc': '#bedc7f',
  '#bedc7f': '#89a257',
  '#89a257': '#5e7334',
  '#5e7334': '#5e7334',
  // Wall
  '#8b93af': '#6b7390',
  // White (blank note + polaroid 1)
  '#ffffff': '#dae0ea',
  '#dae0ea': '#bec8d4',
  '#bec8d4': '#a6acb5',
  '#a6acb5': '#a6acb5',
  // Polaroid 2 (peach)
  '#ffe9e3': '#d7bcb4',
  '#d7bcb4': '#d7bcb4',
  // Polaroid 3 (mint)
  '#b5e7cb': '#77b994',
  '#77b994': '#528669',
  '#528669': '#528669',
  // Polaroid 4 (lime)
  '#f0ef84': '#cdcc70',
  '#cdcc70': '#999856',
  '#999856': '#999856',
  // Polaroid 5 (sky)
  '#88d3eb': '#42bfe8',
  '#42bfe8': '#3796b5',
  '#3796b5': '#3796b5',
  // Polaroid 6 (rose)
  '#e27285': '#b25266',
  '#b25266': '#903c4e',
  '#903c4e': '#903c4e',
}

// ─── Border zone ─────────────────────────────────────────────────────────────
export const BORDER = 13  // 1x px

// ─── Font ────────────────────────────────────────────────────────────────────
export const FONT_MAX = 8
export const FONT_MIN = 5
export const CHAR_LIMIT = 24
export const CHAR_LIMIT_BLANK = 48

// ─── Loading animation ───────────────────────────────────────────────────────
export const LOADING_FRAME_COUNT = 13
export const LOADING_FPS = 12

// ─── Mini Mike (loading screen only) ─────────────────────────────────────────
export const MINI_MIKE_FRAME_COUNT = 6
export const MINI_MIKE_FPS = 8
