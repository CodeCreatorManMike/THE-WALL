import { NOTE_VARIANTS } from './variants'
import { LOADING_FRAME_COUNT, MINI_MIKE_FRAME_COUNT } from './constants'

// ─── Shadow mask (pixel-accurate, precomputed from sprite alpha) ──────────────
export interface ShadowMask {
  // Flat arrays: [x0, y0, x1, y1, ...]  in 1x sprite coords
  leftEdge:   Int16Array
  bottomEdge: Int16Array
  w: number
  h: number
}

function computeShadowMask(img: HTMLImageElement): ShadowMask {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, w, h)

  const alpha = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0
    return data[(y * w + x) * 4 + 3]
  }

  const left: number[] = []
  const bot: number[] = []

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha(x, y) > 64) {
        // Left edge: opaque pixel whose left neighbour is not opaque
        if (alpha(x - 1, y) <= 64) left.push(x - 1, y)
        // Bottom edge: opaque pixel whose bottom neighbour is not opaque
        if (alpha(x, y + 1) <= 64) bot.push(x, y + 1)
      }
    }
  }

  return { leftEdge: new Int16Array(left), bottomEdge: new Int16Array(bot), w, h }
}

// ─── Asset store ──────────────────────────────────────────────────────────────
export interface AssetStore {
  notes: Record<string, HTMLImageElement>
  shadowMasks: Record<string, ShadowMask>
  ui: {
    handIdle: HTMLImageElement
    handGripping: HTMLImageElement
    xButton: HTMLImageElement
    tickButton: HTMLImageElement
    backButton: HTMLImageElement
    forwardButton: HTMLImageElement
    textbox: HTMLImageElement
  }
  loading: HTMLImageElement[]
  miniMike: HTMLImageElement[]
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

export async function loadAllAssets(): Promise<AssetStore> {
  // Notes
  const noteEntries = await Promise.all(
    NOTE_VARIANTS.map(async v => {
      const img = await loadImage(`/assets/notes/${v.file}`)
      return [v.key, img] as [string, HTMLImageElement]
    })
  )
  const notes = Object.fromEntries(noteEntries)

  // Shadow masks — precomputed from sprite alpha at load time
  const shadowMasks: Record<string, ShadowMask> = {}
  for (const [key, img] of Object.entries(notes)) {
    shadowMasks[key] = computeShadowMask(img)
  }

  // UI
  const [handIdle, handGripping, xButton, tickButton, backButton, forwardButton, textbox] =
    await Promise.all([
      loadImage('/assets/ui/hand_idle.png'),
      loadImage('/assets/ui/hand_gripping.png'),
      loadImage('/assets/ui/x_button.png'),
      loadImage('/assets/ui/tick_button.png'),
      loadImage('/assets/ui/back_button.png'),
      loadImage('/assets/ui/forward_button.png'),
      loadImage('/assets/ui/textbox.png'),
    ])

  const loading = await Promise.all(
    Array.from({ length: LOADING_FRAME_COUNT }, (_, i) =>
      loadImage(`/assets/loading/loading_animation${i + 1}.png`)
    )
  )

  const miniMike = await Promise.all(
    Array.from({ length: MINI_MIKE_FRAME_COUNT }, (_, i) =>
      loadImage(`/assets/mini-mike/sprite-000${i + 4}.png`)
    )
  )

  return {
    notes, shadowMasks,
    ui: { handIdle, handGripping, xButton, tickButton, backButton, forwardButton, textbox },
    loading,
    miniMike,
  }
}
