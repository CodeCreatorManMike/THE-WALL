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
  yellow: '#ffd860',
  blue:   '#a1d5e6',
  red:    '#ef462e',
}
export const NOTE_HEADER_COLORS: Record<string, string> = {
  yellow: '#f7b23b',
  blue:   '#82b5d9',
  red:    '#f01b0f',
}
export const TEXT_COLORS: Record<string, string> = {
  yellow: '#1a1008',
  blue:   '#0d1a24',
  red:    '#ffffff',
}

export const SHADOW_MAP: Record<string, string> = {
  '#ffd860': '#f7b23b',
  '#f7b23b': '#cf9634',
  '#cf9634': '#aa761b',
  '#aa761b': '#aa761b',
  '#a1d5e6': '#82b5d9',
  '#82b5d9': '#6699cc',
  '#6699cc': '#3d6d9d',
  '#3d6d9d': '#3d6d9d',
  '#ef462e': '#f01b0f',
  '#f01b0f': '#6c0e00',
  '#6c0e00': '#480900',
  '#480900': '#480900',
  '#8b93af': '#6b7390',
  '#ffffff': '#dae0ea',
  '#dae0ea': '#bec8d4',
}

// ─── Border zone ─────────────────────────────────────────────────────────────
export const BORDER = 13  // 1x px

// ─── Font ────────────────────────────────────────────────────────────────────
export const FONT_MAX = 8
export const FONT_MIN = 5
export const CHAR_LIMIT = 24

// ─── Loading animation ───────────────────────────────────────────────────────
export const LOADING_FRAME_COUNT = 13
export const LOADING_FPS = 12

// ─── Mini Mike (loading screen only) ─────────────────────────────────────────
export const MINI_MIKE_FRAME_COUNT = 6
export const MINI_MIKE_FPS = 8
