import { NOTE_VARIANTS } from './variants'
import { LOADING_FRAME_COUNT, MINI_MIKE_FRAME_COUNT } from './constants'

export interface AssetStore {
  notes: Record<string, HTMLImageElement>
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

  // Loading frames
  const loading = await Promise.all(
    Array.from({ length: LOADING_FRAME_COUNT }, (_, i) =>
      loadImage(`/assets/loading/loading_animation${i + 1}.png`)
    )
  )

  // Mini Mike frames
  const miniMike = await Promise.all(
    Array.from({ length: MINI_MIKE_FRAME_COUNT }, (_, i) =>
      loadImage(`/assets/mini-mike/sprite-000${i + 4}.png`)
    )
  )

  return {
    notes,
    ui: { handIdle, handGripping, xButton, tickButton, backButton, forwardButton, textbox },
    loading,
    miniMike,
  }
}
