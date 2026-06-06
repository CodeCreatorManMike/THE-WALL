import { loadAllAssets, type AssetStore } from './assets'
import {
  getScale, WORLD_SIZE, CANVAS_W, CANVAS_H,
  COLOR_WALL_BG, COLOR_WALL_SHADOW,
  BORDER, CHAR_LIMIT, CHAR_LIMIT_BLANK,
  LOADING_FPS, MINI_MIKE_FPS,
} from './constants'
import { NOTE_VARIANTS, getVariantsByType, type NoteVariant } from './variants'
import { renderNoteText } from './text'
import { drawNoteShadow } from './shadow'
import type { AppState, NoteData, Camera } from './types'

type ItemGroup = 'sticky' | 'polaroid' | 'blank'
const GROUP_LABELS: Record<ItemGroup, string> = {
  sticky:   'STICKY NOTE',
  polaroid: 'POLAROIDS',
  blank:    'BLANK NOTE',
}

// Resize a user-uploaded image to a fixed size before storing in the DB.
// Keeps the base64 payload under ~100KB (JPEG 80% at 320×240).
function resizeImageForStorage(img: HTMLImageElement): string {
  const TARGET_W = 320
  const TARGET_H = 240
  const c = document.createElement('canvas')
  c.width = TARGET_W
  c.height = TARGET_H
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(img, 0, 0, TARGET_W, TARGET_H)
  return c.toDataURL('image/jpeg', 0.8)
}

export class TongueApp {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private assets!: AssetStore
  private ready = false
  private destroyed = false
  private rafId = 0

  private inputEl!: HTMLInputElement
  private fileInputEl!: HTMLInputElement

  private state: AppState = 'LOADING'

  // Loading
  private loadingFrame = 0
  private loadingLastTick = 0
  private loadingComplete = false
  private loadingIsLoop = false
  private mikeyFrameLoad = 0
  private mikeyLoadLastTick = 0

  private pollInterval = 0

  // Edit — item group + per-group variant index
  private itemGroup: ItemGroup = 'sticky'
  private groupVariantIdx = 0
  private editTextboxRect: { x: number; y: number; w: number; h: number } | null = null
  private editText = ''
  private cursorVisible = true
  private cursorLastBlink = 0

  // Polaroid image (current session)
  private polaroidImageData = ''
  private polaroidImage: HTMLImageElement | null = null
  // Cache data-URL → loaded HTMLImageElement for wall rendering
  private imageCache = new Map<string, HTMLImageElement | null>()

  // Wall
  private camera: Camera = { x: 0, y: 0 }
  private savedNotes: NoteData[] = []
  private activeNote: NoteData | null = null
  private globalZIndex = 0

  // Drag / pan
  private isDraggingWall = false
  private isDraggingNote = false
  private dragStart = { x: 0, y: 0 }
  private cameraStart = { x: 0, y: 0 }
  private noteDragOffset = { x: 0, y: 0 }
  private velocity = { x: 0, y: 0 }
  private lastMovePos = { x: 0, y: 0 }
  private momentumId = 0

  // Pinch-to-zoom
  private cameraZoom = 1.0
  private activePointers = new Map<number, { x: number; y: number }>()
  private pinchStartDist = 0
  private pinchStartZoom = 1.0

  // Cursor
  private mouseX = 0
  private mouseY = 0
  private isGripping = false
  private isTouch = false

  // Hit areas
  private editButtons: Record<string, {x:number;y:number;w:number;h:number}> = {}
  private wallButtons: Record<string, {x:number;y:number;w:number;h:number}> = {}
  private loadingButtons: Record<string, {x:number;y:number;w:number;h:number}> = {}

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
  }

  // ─── Variant helpers ───────────────────────────────────────────────────────
  private get groupVariants(): NoteVariant[] {
    return getVariantsByType(this.itemGroup)
  }

  private get currentVariant(): NoteVariant {
    const gv = this.groupVariants
    const idx = Math.max(0, Math.min(this.groupVariantIdx, gv.length - 1))
    return gv[idx] || NOTE_VARIANTS[0]
  }

  private get currentCharLimit(): number {
    return this.itemGroup === 'blank' ? CHAR_LIMIT_BLANK : CHAR_LIMIT
  }

  // ─── Start ─────────────────────────────────────────────────────────────────
  async start() {
    this.canvas.setAttribute('tabindex', '0')
    this.canvas.style.outline = 'none'

    this.resize()
    window.addEventListener('resize', this.resize)
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('touchend', this.onTouchEndKeyboard, { passive: false })
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerCancel)
    window.addEventListener('keydown', this.onKeyDown)

    this.inputEl = document.createElement('input')
    this.inputEl.type = 'text'
    this.inputEl.maxLength = CHAR_LIMIT
    this.inputEl.setAttribute('inputmode', 'text')
    this.inputEl.setAttribute('autocomplete', 'off')
    this.inputEl.setAttribute('autocorrect', 'off')
    this.inputEl.setAttribute('autocapitalize', 'none')
    this.inputEl.setAttribute('spellcheck', 'false')
    this.inputEl.style.cssText = `
      position: fixed; top: -9999px; left: -9999px;
      opacity: 0; width: 1px; height: 1px; font-size: 16px;
      border: none; outline: none; background: transparent;
      pointer-events: none;
    `
    document.body.appendChild(this.inputEl)
    this.inputEl.addEventListener('input', this.onNativeInput)

    this.fileInputEl = document.createElement('input')
    this.fileInputEl.type = 'file'
    this.fileInputEl.accept = 'image/*'
    this.fileInputEl.style.cssText = `
      position: fixed; top: -9999px; left: -9999px;
      opacity: 0; width: 1px; height: 1px;
      pointer-events: none;
    `
    document.body.appendChild(this.fileInputEl)
    this.fileInputEl.addEventListener('change', this.onFileSelected)

    this.assets = await loadAllAssets()
    this.ready = true

    this.camera.x = WORLD_SIZE / 2 - CANVAS_W / 2
    this.camera.y = WORLD_SIZE / 2 - CANVAS_H / 2

    try { this.canvas.focus() } catch { /**/ }

    this.loadNotes()
    this.pollInterval = window.setInterval(() => this.loadNotes(), 30_000)
    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy() {
    this.destroyed = true
    clearInterval(this.pollInterval)
    cancelAnimationFrame(this.rafId)
    cancelAnimationFrame(this.momentumId)
    window.removeEventListener('resize', this.resize)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('touchend', this.onTouchEndKeyboard)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerCancel)
    window.removeEventListener('keydown', this.onKeyDown)
    this.inputEl?.remove()
    this.fileInputEl?.remove()
  }

  // ─── Resize ────────────────────────────────────────────────────────────────
  private resize = () => {
    this.canvas.width  = window.innerWidth
    this.canvas.height = window.innerHeight
    this.ctx.imageSmoothingEnabled = false
  }

  // ─── Loop ──────────────────────────────────────────────────────────────────
  private loop = (now: number) => {
    if (this.destroyed) return
    this.rafId = requestAnimationFrame(this.loop)
    this.ctx.imageSmoothingEnabled = false
    this.render(now)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  private render(now: number) {
    const { width: w, height: h } = this.canvas
    this.ctx.clearRect(0, 0, w, h)

    if (!this.ready) {
      this.ctx.fillStyle = COLOR_WALL_BG
      this.ctx.fillRect(0, 0, w, h)
      return
    }

    if      (this.state === 'LOADING') this.renderLoading(now)
    else if (this.state === 'EDIT')    this.renderEdit(now)
    else                               this.renderWall(now)

    this.renderCursor()
  }

  // ─── LOADING ───────────────────────────────────────────────────────────────
  private renderLoading(now: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const scale = getScale()

    ctx.fillStyle = COLOR_WALL_BG
    ctx.fillRect(0, 0, w, h)

    const mikey = this.assets.miniMike
    if (mikey.length) {
      const mInterval = 1000 / MINI_MIKE_FPS
      if (now - this.mikeyLoadLastTick > mInterval) {
        this.mikeyLoadLastTick = now
        this.mikeyFrameLoad = (this.mikeyFrameLoad + 1) % mikey.length
      }
      const mFrame = mikey[this.mikeyFrameLoad]
      const mScale = Math.max(1, Math.min(
        Math.max(3, Math.floor(Math.min(w, h) * 0.003)),
        Math.floor(w * 0.80 / mFrame.naturalWidth)
      ))
      const mw = mFrame.naturalWidth  * mScale
      const mh = mFrame.naturalHeight * mScale
      ctx.drawImage(mFrame, Math.floor(w / 2 - mw / 2), Math.floor(h * 0.28 - mh / 2), mw, mh)
    }

    const frames = this.assets.loading
    if (frames.length) {
      const interval = 1000 / LOADING_FPS
      if (now - this.loadingLastTick > interval) {
        this.loadingLastTick = now
        if (this.loadingFrame < frames.length - 1) {
          this.loadingFrame++
        } else if (this.loadingIsLoop) {
          this.loadingFrame = 0
        } else if (!this.loadingComplete) {
          this.loadingComplete = true
          setTimeout(() => this.transitionTo('EDIT'), 400)
        }
      }
      const frame = frames[this.loadingFrame]
      const maxBarScale = Math.max(2, Math.floor(w * 0.80 / frame.naturalWidth))
      const barScale = Math.min(Math.max(scale * 2, 4), maxBarScale)
      const fw = frame.naturalWidth  * barScale
      const fh = frame.naturalHeight * barScale
      ctx.drawImage(frame, Math.floor(w/2 - fw/2), Math.floor(h * 0.62 - fh/2), fw, fh)
    }

    if (this.loadingIsLoop) {
      const btnS = Math.max(32, Math.floor(Math.min(w,h) * 0.04))
      const edge  = Math.max(20, Math.floor(w * 0.025))
      const bx = w - edge - btnS
      const by = edge
      ctx.drawImage(this.assets.ui.forwardButton, bx, by, btnS, btnS)
      this.loadingButtons = { fwBtn: { x: bx - 10, y: by - 10, w: btnS + 20, h: btnS + 20 } }
    }
  }

  // ─── EDIT ──────────────────────────────────────────────────────────────────
  private renderEdit(now: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.fillStyle = COLOR_WALL_BG
    ctx.fillRect(0, 0, w, h)

    const variant = this.currentVariant

    const noteDisplayPx = Math.min(Math.floor(Math.min(w, h) * 0.38), 320)
    const noteW = noteDisplayPx
    const noteH = noteDisplayPx
    const noteScale = noteDisplayPx / 48

    const tbScale = noteDisplayPx / 96
    const tbW = Math.floor(109 * tbScale)
    const tbH = Math.floor(96  * tbScale)

    const gap    = Math.max(16, Math.floor(w * 0.025))
    const totalW = noteW + gap + tbW
    const noteX  = Math.max(Math.floor(w * 0.02), Math.floor((w - totalW) / 2))

    const labelFontSz = Math.max(7, Math.floor(noteDisplayPx * 0.10))
    const iconBtnS    = Math.max(18, Math.floor(noteDisplayPx * 0.13))
    const labelRowH   = iconBtnS + Math.max(6, Math.floor(h * 0.012))

    const noteY  = Math.floor(h / 2 - noteH / 2) + Math.floor(labelRowH / 2)

    // Shadow
    const mask = this.assets.shadowMasks[variant.key]
    if (mask) {
      ctx.fillStyle = COLOR_WALL_SHADOW
      const le = mask.leftEdge, be = mask.bottomEdge
      for (let i = 0; i < le.length; i += 2) {
        ctx.fillRect(noteX + le[i] * noteScale, noteY + le[i+1] * noteScale, noteScale, noteScale)
      }
      for (let i = 0; i < be.length; i += 2) {
        ctx.fillRect(noteX + be[i] * noteScale, noteY + be[i+1] * noteScale, noteScale, noteScale)
      }
    }

    // Polaroid: draw user photo behind sprite
    if (variant.type === 'polaroid' && this.polaroidImage && variant.imageArea) {
      const ia = variant.imageArea
      ctx.save()
      ctx.imageSmoothingEnabled = true
      ctx.beginPath()
      ctx.rect(noteX + ia.x * noteScale, noteY + ia.y * noteScale, ia.w * noteScale, ia.h * noteScale)
      ctx.clip()
      ctx.drawImage(this.polaroidImage, noteX + ia.x * noteScale, noteY + ia.y * noteScale, ia.w * noteScale, ia.h * noteScale)
      ctx.restore()
      ctx.imageSmoothingEnabled = false
    }

    const sprite = this.assets.notes[variant.key]
    if (sprite) ctx.drawImage(sprite, noteX, noteY, noteW, noteH)
    renderNoteText(
      ctx, this.editText, variant.color, variant.zone,
      noteX, noteY, noteScale, getScale(),
      variant.type === 'polaroid'
    )

    // Textbox
    const tbX = noteX + noteW + gap
    const tbY = Math.floor(h / 2 - tbH / 2) + Math.floor(labelRowH / 2)
    this.editTextboxRect = { x: tbX, y: tbY, w: tbW, h: tbH }
    if (this.assets.ui.textbox) ctx.drawImage(this.assets.ui.textbox, tbX, tbY, tbW, tbH)
    this.renderTextboxText(ctx, tbX, tbY, tbW, tbH)

    // Type label row
    const labelRowY = noteY - labelRowH
    ctx.save()
    ctx.font = `${labelFontSz}px minecraft`
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    const labelText = GROUP_LABELS[this.itemGroup]
    const labelW = ctx.measureText(labelText).width
    ctx.fillText(labelText, noteX, labelRowY + Math.floor(iconBtnS / 2))
    ctx.restore()

    const swapX = noteX + Math.ceil(labelW) + 6
    const swapY = labelRowY
    ctx.drawImage(this.assets.ui.swapItemButton, swapX, swapY, iconBtnS, iconBtnS)

    let uploadBtnRect: { x:number;y:number;w:number;h:number } | null = null
    if (this.itemGroup === 'polaroid') {
      const uploadX = swapX + iconBtnS + 4
      ctx.drawImage(this.assets.ui.uploadItemButton, uploadX, swapY, iconBtnS, iconBtnS)
      uploadBtnRect = { x: uploadX - 8, y: swapY - 8, w: iconBtnS + 16, h: iconBtnS + 16 }
    }

    // Corner buttons
    const cornerBtnS = Math.max(36, Math.floor(Math.min(w,h) * 0.045))
    const edge = Math.max(20, Math.floor(w * 0.025))
    ctx.drawImage(this.assets.ui.xButton,       edge,               edge, cornerBtnS, cornerBtnS)
    ctx.drawImage(this.assets.ui.forwardButton, w-edge-cornerBtnS,  edge, cornerBtnS, cornerBtnS)

    // Arrows + check
    const arrowS = Math.min(
      Math.max(36, Math.floor(Math.min(w, h) * 0.07)),
      Math.floor(w * 0.12)
    )
    const checkS = Math.max(32, Math.floor(arrowS * 0.85))
    const noteCentreX = noteX + Math.floor(noteW / 2)
    const arrowY = noteY + noteH + Math.max(16, Math.floor(h * 0.02))
    const naturalGap = arrowS + Math.floor(arrowS * 0.4)
    const maxGap     = Math.max(4, noteCentreX - arrowS - edge - 4)
    const arrowGap   = Math.min(naturalGap, maxGap)

    ctx.drawImage(this.assets.ui.tickButton,
      noteCentreX - Math.floor(checkS/2),
      arrowY + Math.floor((arrowS - checkS) / 2),
      checkS, checkS
    )

    const pad = 14
    const newButtons: Record<string, {x:number;y:number;w:number;h:number}> = {
      xBtn:     { x: edge - pad,              y: edge - pad,  w: cornerBtnS + pad*2, h: cornerBtnS + pad*2 },
      fwBtn:    { x: w-edge-cornerBtnS-pad,   y: edge - pad,  w: cornerBtnS + pad*2, h: cornerBtnS + pad*2 },
      checkBtn: { x: noteCentreX - checkS/2 - pad, y: arrowY - pad, w: checkS + pad*2, h: arrowS + pad*2 },
      swapBtn:  { x: swapX - 8, y: swapY - 8, w: iconBtnS + 16, h: iconBtnS + 16 },
    }

    if (this.itemGroup !== 'blank') {
      ctx.drawImage(this.assets.ui.backButton,    noteCentreX - arrowGap - arrowS, arrowY, arrowS, arrowS)
      ctx.drawImage(this.assets.ui.forwardButton, noteCentreX + arrowGap,          arrowY, arrowS, arrowS)
      newButtons.leftArrow  = { x: noteCentreX - arrowGap - arrowS - pad, y: arrowY - pad, w: arrowS + pad*2, h: arrowS + pad*2 }
      newButtons.rightArrow = { x: noteCentreX + arrowGap - pad,          y: arrowY - pad, w: arrowS + pad*2, h: arrowS + pad*2 }
    }

    if (uploadBtnRect) newButtons.uploadBtn = uploadBtnRect

    this.editButtons = newButtons

    if (now - this.cursorLastBlink > 500) {
      this.cursorVisible = !this.cursorVisible
      this.cursorLastBlink = now
    }
  }

  private renderTextboxText(
    ctx: CanvasRenderingContext2D,
    tbX: number, tbY: number, tbW: number, tbH: number
  ) {
    const textStartX = tbX + Math.floor((20/109) * tbW)
    const textWidth  = Math.floor((75/109) * tbW)
    const firstLineY = tbY + Math.floor((32/96) * tbH)
    const lineH      = Math.max(1, Math.floor((7/96) * tbH))
    const bodyBottom = tbY + Math.floor((76/96) * tbH)
    const fontSize   = Math.max(5, lineH - 2)

    ctx.save()
    ctx.font = `${fontSize}px minecraft`
    ctx.imageSmoothingEnabled = false
    const actualCharW = ctx.measureText('M').width || Math.ceil(fontSize * 0.5)
    const perLine = Math.max(1, Math.floor(textWidth / actualCharW))

    const lines: string[] = []
    let cur = ''
    for (const ch of this.editText) {
      if (cur.length >= perLine) { lines.push(cur); cur = ch }
      else cur += ch
    }
    if (cur) lines.push(cur)

    ctx.fillStyle = '#1a1008'
    ctx.textBaseline = 'top'
    ctx.beginPath()
    ctx.rect(textStartX, firstLineY, textWidth, bodyBottom - firstLineY)
    ctx.clip()

    lines.slice(0, 6).forEach((line, i) => {
      const dy = firstLineY + i * lineH
      if (dy + fontSize <= bodyBottom) ctx.fillText(line, textStartX, dy)
    })

    if (this.cursorVisible) {
      const lastIdx = Math.min(lines.length - 1, 5)
      const lastLine = lines[lastIdx] || ''
      const cx = textStartX + lastLine.length * actualCharW
      const cy = firstLineY + lastIdx * lineH
      ctx.fillRect(cx, cy, Math.max(1, Math.ceil(tbW/109)), fontSize)
    }
    ctx.restore()
  }

  // ─── WALL ──────────────────────────────────────────────────────────────────
  private renderWall(_now: number) {
    const ctx = this.ctx
    const scale = getScale() * this.cameraZoom
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.fillStyle = COLOR_WALL_BG
    ctx.fillRect(0, 0, w, h)

    const allNotes = this.getAllNotes()
    for (const note of allNotes) {
      note.screenX = Math.floor((note.worldX - this.camera.x) * scale)
      note.screenY = Math.floor((note.worldY - this.camera.y) * scale)
    }

    const sorted = [...allNotes].sort((a, b) => a.zIndex - b.zIndex)
    for (const note of sorted) {
      if (this.isNoteVisible(note, scale)) this.drawNote(ctx, note, sorted, scale)
    }

    this.renderWallUI(scale)
  }

  private drawNote(
    ctx: CanvasRenderingContext2D,
    note: NoteData,
    allNotes: NoteData[],
    scale: number
  ) {
    const { screenX: sx, screenY: sy } = note
    const sw = 48 * scale, sh = 48 * scale
    const mask = this.assets.shadowMasks[note.variantKey]

    if (mask) drawNoteShadow(ctx, note, mask, allNotes, scale)

    const sprite  = this.assets.notes[note.variantKey]
    const variant = NOTE_VARIANTS.find(v => v.key === note.variantKey)

    ctx.save()

    // Polaroid: draw user photo behind the frame sprite
    if (variant?.type === 'polaroid' && note.imageData && variant.imageArea) {
      const userImg = this.getCachedImage(note.imageData)
      if (userImg) {
        const ia = variant.imageArea
        ctx.save()
        ctx.imageSmoothingEnabled = true
        ctx.beginPath()
        ctx.rect(sx + ia.x * scale, sy + ia.y * scale, ia.w * scale, ia.h * scale)
        ctx.clip()
        ctx.drawImage(userImg, sx + ia.x * scale, sy + ia.y * scale, ia.w * scale, ia.h * scale)
        ctx.restore()
        ctx.imageSmoothingEnabled = false
      }
    }

    if (sprite) ctx.drawImage(sprite, sx, sy, sw, sh)
    if (variant) renderNoteText(
      ctx, note.text, note.color, variant.zone, sx, sy, scale,
      undefined, variant.type === 'polaroid'
    )
    ctx.restore()
  }

  private getCachedImage(dataUrl: string): HTMLImageElement | null {
    if (!dataUrl) return null
    if (this.imageCache.has(dataUrl)) return this.imageCache.get(dataUrl) || null
    this.imageCache.set(dataUrl, null)
    const img = new Image()
    img.onload = () => { this.imageCache.set(dataUrl, img) }
    img.src = dataUrl
    return null
  }

  private renderWallUI(scale: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const btnS = Math.max(44, Math.floor(Math.min(w,h) * 0.05))
    const edge  = Math.max(20, Math.floor(w * 0.03))
    const pad   = 14

    if (this.state === 'PLACING') {
      ctx.drawImage(this.assets.ui.xButton,    edge,           edge, btnS, btnS)
      ctx.drawImage(this.assets.ui.tickButton, w-edge-btnS,    edge, btnS, btnS)
      this.wallButtons = {
        xBtn:     { x: edge-pad,         y: edge-pad, w: btnS+pad*2, h: btnS+pad*2 },
        checkBtn: { x: w-edge-btnS-pad,  y: edge-pad, w: btnS+pad*2, h: btnS+pad*2 },
      }
    } else if (this.state === 'SAVED') {
      ctx.drawImage(this.assets.ui.backButton, edge, edge, btnS, btnS)
      this.wallButtons = { backBtn: { x: edge-pad, y: edge-pad, w: btnS+pad*2, h: btnS+pad*2 } }
    } else if (this.state === 'VIEW_ONLY') {
      ctx.drawImage(this.assets.ui.backButton, edge, edge, btnS, btnS)
      this.wallButtons = { leftArrow: { x: edge-pad, y: edge-pad, w: btnS+pad*2, h: btnS+pad*2 } }
    }
    void scale
  }

  // ─── Cursor ────────────────────────────────────────────────────────────────
  private renderCursor() {
    if (!this.assets) return
    const ctx = this.ctx
    const scale = getScale()
    const img = this.isGripping ? this.assets.ui.handGripping : this.assets.ui.handIdle
    if (!img) return
    const cw = 24 * scale, ch = 24 * scale
    const hotY = this.isTouch ? 12 * scale : 4 * scale
    ctx.drawImage(img, this.mouseX - 8 * scale, this.mouseY - hotY, cw, ch)
  }

  // ─── Hit test ──────────────────────────────────────────────────────────────
  private hit(x: number, y: number, r: {x:number;y:number;w:number;h:number}) {
    return x >= r.x && x <= r.x+r.w && y >= r.y && y <= r.y+r.h
  }

  private isNoteVisible(note: NoteData, scale: number): boolean {
    const { screenX, screenY } = note
    const size = 48 * scale * 2
    return screenX > -size && screenX < this.canvas.width  + size
        && screenY > -size && screenY < this.canvas.height + size
  }

  private isInBorderZone(screenX: number, screenY: number, scale: number): boolean {
    const b = BORDER * scale
    return screenX < b || screenY < b
        || screenX + 48*scale > this.canvas.width  - b
        || screenY + 48*scale > this.canvas.height - b
  }

  // ─── Input ─────────────────────────────────────────────────────────────────
  private onNativeInput = () => {
    if (this.state !== 'EDIT') return
    this.editText = this.inputEl.value.slice(0, this.currentCharLimit)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.state !== 'EDIT') return
    if (this.isTouch) {
      if (e.key === 'Backspace' && this.editText.length > 0) {
        e.preventDefault()
        this.editText = this.editText.slice(0, -1)
        this.inputEl.value = this.editText
      }
      return
    }
    if (e.key === 'Backspace') {
      e.preventDefault()
      this.editText = this.editText.slice(0, -1)
    } else if (e.key.length === 1 && this.editText.length < this.currentCharLimit) {
      this.editText += e.key
    }
    this.inputEl.value = this.editText
  }

  private onFileSelected = () => {
    const file = this.fileInputEl.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (!dataUrl) return
      // Load full image, then resize before storing
      const rawImg = new Image()
      rawImg.onload = () => {
        const resized = resizeImageForStorage(rawImg)
        this.polaroidImageData = resized
        const displayImg = new Image()
        displayImg.onload = () => {
          this.polaroidImage = displayImg
          this.imageCache.set(resized, displayImg)
        }
        displayImg.src = resized
      }
      rawImg.src = dataUrl
    }
    reader.readAsDataURL(file)
    this.fileInputEl.value = ''
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.state !== 'EDIT') e.preventDefault()
    this.mouseX = e.clientX
    this.mouseY = e.clientY
    if (e.pointerType === 'touch') this.isTouch = true
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { this.canvas.setPointerCapture(e.pointerId) } catch { /**/ }

    const zoomable = this.state === 'VIEW_ONLY' || this.state === 'SAVED'
    if (this.activePointers.size === 2 && zoomable) {
      this.isDraggingWall = false
      cancelAnimationFrame(this.momentumId)
      const pts = [...this.activePointers.values()]
      this.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      this.pinchStartZoom = this.cameraZoom
      return
    }

    if (this.state === 'LOADING') {
      this.handleLoadingClick(e)
    } else if (this.state === 'EDIT') {
      if (e.pointerType !== 'touch') this.canvas.focus()
      this.handleEditClick(e)
    } else if (this.state === 'PLACING') {
      this.isGripping = true
      this.handlePlacingDown(e)
    } else if (this.state === 'SAVED') {
      this.isGripping = true
      this.handleSavedClick(e)
    } else if (this.state === 'VIEW_ONLY') {
      this.isGripping = true
      this.handleViewOnlyClick(e)
    }
  }

  private onTouchEndKeyboard = (e: TouchEvent) => {
    if (this.state !== 'EDIT') return
    const r = this.editTextboxRect
    if (!r) return
    const touch = e.changedTouches[0]
    if (!touch) return
    const { clientX: x, clientY: y } = touch
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      e.preventDefault()
      e.stopPropagation()
      this.inputEl.value = this.editText
      this.inputEl.focus()
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    this.mouseX = e.clientX
    this.mouseY = e.clientY
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (this.activePointers.size === 2 && this.pinchStartDist > 0 &&
        (this.state === 'VIEW_ONLY' || this.state === 'SAVED')) {
      this.handlePinchMove()
      return
    }

    if (this.state === 'PLACING') this.handlePlacingMove(e)
    else if (this.isDraggingWall) this.continuePan(e)
  }

  private onPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId)
    if (this.activePointers.size < 2) this.pinchStartDist = 0
    this.isGripping = false
    this.isDraggingNote = false
    const was = this.isDraggingWall
    this.isDraggingWall = false
    if (was) this.applyMomentum()
  }

  // iOS can fire pointercancel instead of pointerup (palm rejection, system gestures).
  // Clean up identically so the pointer map never accumulates ghost entries.
  private onPointerCancel = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId)
    if (this.activePointers.size < 2) this.pinchStartDist = 0
    this.isGripping = false
    this.isDraggingNote = false
    this.isDraggingWall = false
  }

  // ─── Pinch ─────────────────────────────────────────────────────────────────
  private handlePinchMove() {
    if (this.pinchStartDist === 0) return
    const pts = [...this.activePointers.values()]
    const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
    const cx   = (pts[0].x + pts[1].x) / 2
    const cy   = (pts[0].y + pts[1].y) / 2
    const baseScale   = getScale()
    const oldEffScale = baseScale * this.cameraZoom
    const worldCX = cx / oldEffScale + this.camera.x
    const worldCY = cy / oldEffScale + this.camera.y
    const newZoom = Math.max(0.25, Math.min(4.0, this.pinchStartZoom * (dist / this.pinchStartDist)))
    this.cameraZoom = newZoom
    const newEffScale = baseScale * newZoom
    this.camera.x = worldCX - cx / newEffScale
    this.camera.y = worldCY - cy / newEffScale
  }

  // ─── Loading click ─────────────────────────────────────────────────────────
  private handleLoadingClick(e: PointerEvent) {
    const { clientX: x, clientY: y } = e
    for (const [name, r] of Object.entries(this.loadingButtons)) {
      if (this.hit(x, y, r) && name === 'fwBtn') {
        this.loadingIsLoop = false
        this.transitionTo('EDIT')
      }
    }
  }

  // ─── Edit click ────────────────────────────────────────────────────────────
  private handleEditClick(e: PointerEvent) {
    const { clientX: x, clientY: y } = e

    for (const [name, r] of Object.entries(this.editButtons)) {
      if (!this.hit(x, y, r)) continue

      if (name === 'xBtn') {
        this.loadingIsLoop = true
        this.transitionTo('LOADING')
      } else if (name === 'fwBtn') {
        this.transitionTo('VIEW_ONLY')
      } else if (name === 'swapBtn') {
        const order: ItemGroup[] = ['sticky', 'polaroid', 'blank']
        this.itemGroup = order[(order.indexOf(this.itemGroup) + 1) % order.length]
        this.groupVariantIdx = 0
        this.inputEl.maxLength = this.currentCharLimit
        this.syncInputToEditText()
      } else if (name === 'uploadBtn') {
        this.fileInputEl.click()
      } else if (name === 'leftArrow' && this.itemGroup !== 'blank') {
        const gv = this.groupVariants
        this.groupVariantIdx = (this.groupVariantIdx - 1 + gv.length) % gv.length
        this.syncInputToEditText()
      } else if (name === 'rightArrow' && this.itemGroup !== 'blank') {
        const gv = this.groupVariants
        this.groupVariantIdx = (this.groupVariantIdx + 1) % gv.length
        this.syncInputToEditText()
      } else if (name === 'checkBtn') {
        this.spawnActiveNote()
        this.transitionTo('PLACING')
      }
      return
    }

    this.inputEl.value = this.editText
  }

  private syncInputToEditText() {
    this.inputEl.value = this.editText
  }

  private spawnActiveNote() {
    const scale = getScale()
    const variant = this.currentVariant
    const screenX = Math.floor(this.canvas.width  / 2 - 24 * scale)
    const screenY = Math.floor(this.canvas.height / 2 - 24 * scale)
    this.activeNote = {
      variantKey: variant.key,
      color: variant.color,
      text: this.editText,
      worldX: screenX / scale + this.camera.x,
      worldY: screenY / scale + this.camera.y,
      rotation: 0,
      zIndex: this.globalZIndex + 1,
      imageData: variant.type === 'polaroid' && this.polaroidImageData
        ? this.polaroidImageData
        : undefined,
      screenX,
      screenY,
    }
  }

  // ─── Placing ───────────────────────────────────────────────────────────────
  private handlePlacingDown(e: PointerEvent) {
    const { clientX: x, clientY: y } = e

    for (const [name, r] of Object.entries(this.wallButtons)) {
      if (!this.hit(x, y, r)) continue
      if (name === 'xBtn') { this.activeNote = null; this.transitionTo('EDIT') }
      else if (name === 'checkBtn') this.confirmNote()
      return
    }

    if (this.activeNote) {
      const scale = getScale()
      const { screenX, screenY } = this.activeNote
      const size = 48 * scale
      const pad = e.pointerType === 'touch' ? scale * 6 : 0
      if (x >= screenX - pad && x <= screenX + size + pad &&
          y >= screenY - pad && y <= screenY + size + pad) {
        this.isDraggingNote = true
        this.noteDragOffset = {
          x: Math.max(0, Math.min(size, x - screenX)),
          y: Math.max(0, Math.min(size, y - screenY)),
        }
        return
      }
    }

    this.isDraggingWall = true
    this.dragStart = { x, y }
    this.cameraStart = { ...this.camera }
    this.lastMovePos = { x, y }
    this.velocity = { x: 0, y: 0 }
  }

  private handlePlacingMove(e: PointerEvent) {
    const { clientX: x, clientY: y } = e
    const scale = getScale()

    if (this.isDraggingNote && this.activeNote) {
      const newSX = x - this.noteDragOffset.x
      const newSY = y - this.noteDragOffset.y
      if (!this.isInBorderZone(newSX, newSY, scale)) {
        this.activeNote.screenX = newSX
        this.activeNote.screenY = newSY
        this.activeNote.worldX  = newSX / scale + this.camera.x
        this.activeNote.worldY  = newSY / scale + this.camera.y
      }
    } else if (this.isDraggingWall) {
      this.continuePan(e)
    }
  }

  private continuePan(e: PointerEvent) {
    const { clientX: x, clientY: y } = e
    const scale = getScale()
    this.velocity.x = (x - this.lastMovePos.x) / scale
    this.velocity.y = (y - this.lastMovePos.y) / scale
    this.lastMovePos = { x, y }
    this.camera.x = this.cameraStart.x - (x - this.dragStart.x) / scale
    this.camera.y = this.cameraStart.y - (y - this.dragStart.y) / scale
  }

  private applyMomentum() {
    cancelAnimationFrame(this.momentumId)
    const step = () => {
      if (Math.abs(this.velocity.x) < 0.1 && Math.abs(this.velocity.y) < 0.1) return
      this.camera.x -= this.velocity.x
      this.camera.y -= this.velocity.y
      this.velocity.x *= 0.92
      this.velocity.y *= 0.92
      this.momentumId = requestAnimationFrame(step)
    }
    step()
  }

  private handleSavedClick(e: PointerEvent) {
    const { clientX: x, clientY: y } = e
    for (const [name, r] of Object.entries(this.wallButtons)) {
      if (this.hit(x, y, r) && name === 'backBtn') {
        this.activeNote = null
        this.editText = ''
        this.inputEl.value = ''
        this.polaroidImageData = ''
        this.polaroidImage = null
        this.transitionTo('EDIT')
        return
      }
    }
    this.isDraggingWall = true
    this.dragStart = { x, y }
    this.cameraStart = { ...this.camera }
    this.lastMovePos = { x, y }
    this.velocity = { x: 0, y: 0 }
  }

  private handleViewOnlyClick(e: PointerEvent) {
    const { clientX: x, clientY: y } = e
    for (const [name, r] of Object.entries(this.wallButtons)) {
      if (this.hit(x, y, r) && name === 'leftArrow') {
        this.transitionTo('EDIT')
        return
      }
    }
    this.isDraggingWall = true
    this.dragStart = { x, y }
    this.cameraStart = { ...this.camera }
    this.lastMovePos = { x, y }
    this.velocity = { x: 0, y: 0 }
  }

  // ─── Save note ─────────────────────────────────────────────────────────────
  private async confirmNote() {
    if (!this.activeNote) return
    this.activeNote.rotation = 0
    this.activeNote.zIndex = ++this.globalZIndex

    // Push locally without an id — loadNotes will preserve it until server confirms
    const localNote: NoteData = { ...this.activeNote }
    this.savedNotes.push(localNote)
    this.transitionTo('SAVED')

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant:    localNote.variantKey,
          color:      localNote.color,
          text:       localNote.text,
          world_x:    Math.round(localNote.worldX),
          world_y:    Math.round(localNote.worldY),
          rotation:   localNote.rotation,
          z_index:    localNote.zIndex,
          image_data: localNote.imageData ?? null,
        }),
      })
      if (res.ok) {
        const result = await res.json()
        // Stamp the server-assigned id onto our local copy so loadNotes doesn't drop it
        if (result.note?.id) localNote.id = result.note.id
      }
    } catch { /* offline — note stays locally */ }
  }

  // ─── Load notes ────────────────────────────────────────────────────────────
  private async loadNotes() {
    try {
      const res  = await fetch('/api/notes')
      const data = await res.json()

      const serverNotes: NoteData[] = (data.notes || []).map((n: Record<string, unknown>) => ({
        id:         n.id as string,
        variantKey: n.variant as string,
        color:      n.color as string,
        text:       n.text  as string,
        worldX:     n.world_x  as number,
        worldY:     n.world_y  as number,
        rotation:   n.rotation as number,
        zIndex:     n.z_index  as number,
        imageData:  (n.image_data as string) || undefined,
        screenX: 0, screenY: 0,
      }))

      // Pre-warm the image cache for any polaroid photos arriving from server
      for (const note of serverNotes) {
        if (note.imageData) this.getCachedImage(note.imageData)
      }

      // Preserve any locally-placed notes that haven't been confirmed by the server yet
      // (those without a real server id, or id not present in the server list)
      const serverIdSet = new Set(serverNotes.map(n => n.id).filter(Boolean))
      const pendingLocal = this.savedNotes.filter(n => !n.id || !serverIdSet.has(n.id))

      this.savedNotes = [...serverNotes, ...pendingLocal]
      this.globalZIndex = Math.max(0, ...this.savedNotes.map(n => n.zIndex))
    } catch { /* no backend */ }
  }

  private getAllNotes(): NoteData[] {
    if (this.activeNote && this.state === 'PLACING') return [...this.savedNotes, this.activeNote]
    return this.savedNotes
  }

  // ─── Transitions ───────────────────────────────────────────────────────────
  private transitionTo(state: AppState) {
    if (state === 'LOADING') {
      this.loadingFrame = 0
      this.loadingComplete = false
      this.loadingLastTick = 0
    }
    if (state === 'EDIT' || state === 'PLACING') {
      this.cameraZoom = 1.0
      this.pinchStartDist = 0
      this.activePointers.clear()
    }
    if (state === 'EDIT') {
      this.inputEl.maxLength = this.currentCharLimit
      this.inputEl.value = this.editText
      if (!navigator.maxTouchPoints) {
        try { this.canvas.focus() } catch { /**/ }
      }
    }
    this.state = state
  }
}
