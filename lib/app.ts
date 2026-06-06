import { loadAllAssets, type AssetStore } from './assets'
import {
  getScale, WORLD_SIZE, CANVAS_W, CANVAS_H,
  COLOR_WALL_BG, COLOR_UI_BG, COLOR_UI_SHADOW,
  BORDER, CHAR_LIMIT,
  LOADING_FPS, MINI_MIKE_FPS,
  DEEP_SCROLL_TRIGGER,
} from './constants'
import { NOTE_VARIANTS } from './variants'
import { renderNoteText } from './text'
import { drawNoteShadow, drawUIShadow } from './shadow'
import type { AppState, NoteData, Camera } from './types'

export class TongueApp {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private assets!: AssetStore
  private ready = false
  private destroyed = false
  private rafId = 0

  // Hidden input for text (native keyboard on all platforms)
  private inputEl!: HTMLInputElement

  // State
  private state: AppState = 'LOADING'

  // Loading
  private loadingFrame = 0
  private loadingLastTick = 0
  private loadingComplete = false
  private loadingIsLoop = false
  private mikeyFrameLoad = 0
  private mikeyLoadLastTick = 0

  // Mini Mike (deep scroll)
  private mikeyFrame = 0
  private mikeyLastTick = 0

  // Edit
  private variantIndex = 0
  private editText = ''
  private cursorVisible = true
  private cursorLastBlink = 0

  // Wall
  private camera: Camera = { x: 0, y: 0 }
  private savedNotes: NoteData[] = []
  private activeNote: NoteData | null = null
  private globalZIndex = 0

  // Drag/pan
  private isDraggingWall = false
  private isDraggingNote = false
  private dragStart = { x: 0, y: 0 }
  private cameraStart = { x: 0, y: 0 }
  private noteDragOffset = { x: 0, y: 0 }
  private velocity = { x: 0, y: 0 }
  private lastMovePos = { x: 0, y: 0 }
  private momentumId = 0

  // Cursor
  private mouseX = 0
  private mouseY = 0
  private isGripping = false

  // Button hit areas
  private editButtons: Record<string, {x:number;y:number;w:number;h:number}> = {}
  private wallButtons: Record<string, {x:number;y:number;w:number;h:number}> = {}
  private loadingButtons: Record<string, {x:number;y:number;w:number;h:number}> = {}

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
  }

  // ─── Start ─────────────────────────────────────────────────────────────────
  async start() {
    this.resize()
    window.addEventListener('resize', this.resize)
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)

    // Hidden input for keyboard/mobile text entry
    this.inputEl = document.createElement('input')
    this.inputEl.type = 'text'
    this.inputEl.maxLength = CHAR_LIMIT
    this.inputEl.setAttribute('inputmode', 'text')
    this.inputEl.setAttribute('autocomplete', 'off')
    this.inputEl.setAttribute('autocorrect', 'off')
    this.inputEl.setAttribute('autocapitalize', 'none')
    this.inputEl.style.cssText = `
      position: fixed; top: -9999px; left: -9999px;
      opacity: 0; width: 1px; height: 1px; font-size: 16px;
      border: none; outline: none; background: transparent;
    `
    document.body.appendChild(this.inputEl)
    this.inputEl.addEventListener('input', this.onNativeInput)

    this.assets = await loadAllAssets()
    this.ready = true

    this.camera.x = WORLD_SIZE / 2 - CANVAS_W / 2
    this.camera.y = WORLD_SIZE / 2 - CANVAS_H / 2

    this.loadNotes()
    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.rafId)
    cancelAnimationFrame(this.momentumId)
    window.removeEventListener('resize', this.resize)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.inputEl?.remove()
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

    // Wall-color background (not black)
    ctx.fillStyle = COLOR_WALL_BG
    ctx.fillRect(0, 0, w, h)

    // ── Mini Mike animation (always looping during loading) ──
    const mikey = this.assets.miniMike
    if (mikey.length) {
      const mInterval = 1000 / MINI_MIKE_FPS
      if (now - this.mikeyLoadLastTick > mInterval) {
        this.mikeyLoadLastTick = now
        this.mikeyFrameLoad = (this.mikeyFrameLoad + 1) % mikey.length
      }
      const mFrame = mikey[this.mikeyFrameLoad]
      const mScale = Math.max(3, Math.floor(Math.min(w, h) * 0.003))
      const mw = mFrame.naturalWidth  * mScale
      const mh = mFrame.naturalHeight * mScale
      const mx = Math.floor(w / 2 - mw / 2)
      const my = Math.floor(h * 0.25 - mh / 2)
      ctx.drawImage(mFrame, mx, my, mw, mh)
    }

    // ── Loading bar frames ──
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
      const barScale = Math.max(scale * 2, 4)
      const fw = frame.naturalWidth  * barScale
      const fh = frame.naturalHeight * barScale
      ctx.drawImage(frame, Math.floor(w/2 - fw/2), Math.floor(h * 0.65 - fh/2), fw, fh)
    }

    // In loop mode: show → top-right to return to EDIT
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

    ctx.fillStyle = COLOR_UI_BG
    ctx.fillRect(0, 0, w, h)

    const variant = NOTE_VARIANTS[this.variantIndex]

    // ── Note preview (large, left side) ──────────────────────────────────────
    const noteDisplayPx = Math.min(Math.floor(Math.min(w, h) * 0.38), 320)
    const noteW = noteDisplayPx
    const noteH = noteDisplayPx
    const noteScale = noteDisplayPx / 48

    const noteX = Math.floor(w * 0.08)
    const noteY = Math.floor(h / 2 - noteH / 2)

    // Shadow on note only (pixel-accurate shape shadow)
    const mask = this.assets.shadowMasks[variant.key]
    if (mask) {
      ctx.fillStyle = COLOR_UI_SHADOW
      const le = mask.leftEdge, be = mask.bottomEdge
      for (let i = 0; i < le.length; i += 2) {
        ctx.fillRect(noteX + le[i] * noteScale, noteY + le[i+1] * noteScale, noteScale, noteScale)
      }
      for (let i = 0; i < be.length; i += 2) {
        ctx.fillRect(noteX + be[i] * noteScale, noteY + be[i+1] * noteScale, noteScale, noteScale)
      }
    }

    const sprite = this.assets.notes[variant.key]
    if (sprite) ctx.drawImage(sprite, noteX, noteY, noteW, noteH)
    renderNoteText(ctx, this.editText, variant.color, variant.zone, noteX, noteY, noteScale, getScale())

    // ── Textbox widget (right side) ───────────────────────────────────────────
    const tbScale = noteDisplayPx / 96
    const tbW = Math.floor(109 * tbScale)
    const tbH = Math.floor(96  * tbScale)
    const tbX = noteX + noteW + Math.floor(w * 0.06)
    const tbY = Math.floor(h / 2 - tbH / 2)

    if (this.assets.ui.textbox) ctx.drawImage(this.assets.ui.textbox, tbX, tbY, tbW, tbH)
    this.renderTextboxText(ctx, tbX, tbY, tbW, tbH)

    // ── Buttons ───────────────────────────────────────────────────────────────
    // Corner buttons (X, view wall)
    const cornerBtnS = Math.max(36, Math.floor(Math.min(w,h) * 0.045))
    const edge = Math.max(20, Math.floor(w * 0.025))

    ctx.drawImage(this.assets.ui.xButton,        edge,           edge,           cornerBtnS, cornerBtnS)
    ctx.drawImage(this.assets.ui.forwardButton,  w-edge-cornerBtnS, edge,       cornerBtnS, cornerBtnS)

    // Variant selection arrows + check — LARGE and clearly visible
    const arrowS = Math.max(60, Math.floor(Math.min(w,h) * 0.07))
    const checkS = Math.max(48, Math.floor(Math.min(w,h) * 0.06))
    const noteCentreX = noteX + Math.floor(noteW / 2)
    const arrowY = noteY + noteH + Math.max(20, Math.floor(h * 0.025))
    const arrowGap = arrowS + Math.floor(arrowS * 0.4)

    ctx.drawImage(this.assets.ui.backButton,    noteCentreX - arrowGap - arrowS, arrowY, arrowS, arrowS)
    ctx.drawImage(this.assets.ui.tickButton,    noteCentreX - Math.floor(checkS/2), arrowY + Math.floor((arrowS-checkS)/2), checkS, checkS)
    ctx.drawImage(this.assets.ui.forwardButton, noteCentreX + arrowGap,           arrowY, arrowS, arrowS)

    const pad = 16
    this.editButtons = {
      xBtn:       { x: edge-pad,               y: edge-pad,                   w: cornerBtnS+pad*2, h: cornerBtnS+pad*2 },
      fwBtn:      { x: w-edge-cornerBtnS-pad,  y: edge-pad,                   w: cornerBtnS+pad*2, h: cornerBtnS+pad*2 },
      leftArrow:  { x: noteCentreX-arrowGap-arrowS-pad, y: arrowY-pad,        w: arrowS+pad*2, h: arrowS+pad*2 },
      checkBtn:   { x: noteCentreX-checkS/2-pad, y: arrowY-pad,               w: checkS+pad*2, h: checkS+pad*2 },
      rightArrow: { x: noteCentreX+arrowGap-pad, y: arrowY-pad,               w: arrowS+pad*2, h: arrowS+pad*2 },
    }

    // Cursor blink
    if (now - this.cursorLastBlink > 500) {
      this.cursorVisible = !this.cursorVisible
      this.cursorLastBlink = now
    }
  }

  private renderTextboxText(
    ctx: CanvasRenderingContext2D,
    tbX: number, tbY: number, tbW: number, tbH: number
  ) {
    // Textbox sprite structure (109×96px):
    //   rows 17 = top border, rows 18-28 = red header, row 29 = divider
    //   rows 30-77 = white body, ruled lines at 1x rows: 38,45,51,57,63,69
    const textStartX = tbX + Math.floor((14/109) * tbW)
    const textWidth  = Math.floor((82/109) * tbW)
    const firstLineY = tbY + Math.floor((32/96) * tbH)
    const lineH      = Math.max(1, Math.floor((6.5/96) * tbH))
    const bodyBottom = tbY + Math.floor((77/96) * tbH)

    const fontSize = Math.max(5, lineH - 2)
    const charW = Math.ceil(fontSize * 0.6) + 1
    const perLine = Math.max(1, Math.floor(textWidth / charW))

    const lines: string[] = []
    let cur = ''
    for (const ch of this.editText) {
      if (cur.length >= perLine) { lines.push(cur); cur = ch }
      else cur += ch
    }
    if (cur) lines.push(cur)

    ctx.save()
    ctx.font = `${fontSize}px minecraft`
    ctx.fillStyle = '#1a1008'
    ctx.textBaseline = 'top'
    ctx.imageSmoothingEnabled = false
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
      const cx = textStartX + lastLine.length * charW
      const cy = firstLineY + lastIdx * lineH
      ctx.fillRect(cx, cy, Math.max(1, Math.ceil(tbW/109)), fontSize)
    }
    ctx.restore()
  }

  // ─── WALL (PLACING / SAVED / VIEW_ONLY) ───────────────────────────────────
  private renderWall(now: number) {
    const ctx = this.ctx
    const scale = getScale()
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

    this.maybeDrawMiniMike(ctx, now, scale)
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

    // Pixel-accurate shadow (follows actual sprite edges)
    if (mask) drawNoteShadow(ctx, note, mask, allNotes, scale)

    const sprite = this.assets.notes[note.variantKey]
    const variant = NOTE_VARIANTS.find(v => v.key === note.variantKey)

    ctx.save()
    if (note.rotation) {
      ctx.translate(sx + sw/2, sy + sh/2)
      ctx.rotate((note.rotation * Math.PI) / 180)
      if (sprite) ctx.drawImage(sprite, -sw/2, -sh/2, sw, sh)
      if (variant) renderNoteText(ctx, note.text, note.color, variant.zone, -sw/2, -sh/2, scale)
    } else {
      if (sprite) ctx.drawImage(sprite, sx, sy, sw, sh)
      if (variant) renderNoteText(ctx, note.text, note.color, variant.zone, sx, sy, scale)
    }
    ctx.restore()
  }

  private renderWallUI(scale: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const btnS = Math.max(32, Math.floor(Math.min(w,h) * 0.04))
    const edge  = Math.max(20, Math.floor(w * 0.025))
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

  private maybeDrawMiniMike(ctx: CanvasRenderingContext2D, now: number, scale: number) {
    const cameraStartY = WORLD_SIZE / 2 - CANVAS_H / 2
    if (this.camera.y - cameraStartY < DEEP_SCROLL_TRIGGER) return

    const frames = this.assets.miniMike
    if (!frames.length) return

    const interval = 1000 / MINI_MIKE_FPS
    if (now - this.mikeyLastTick > interval) {
      this.mikeyLastTick = now
      this.mikeyFrame = (this.mikeyFrame + 1) % frames.length
    }
    const frame = frames[this.mikeyFrame]
    const fw = Math.floor(frame.naturalWidth  * scale)
    const fh = Math.floor(frame.naturalHeight * scale)
    const worldY = cameraStartY + DEEP_SCROLL_TRIGGER + CANVAS_H
    ctx.drawImage(frame,
      Math.floor(this.canvas.width  / 2 - fw / 2),
      Math.floor((worldY - this.camera.y) * scale),
      fw, fh
    )
  }

  // ─── Cursor ────────────────────────────────────────────────────────────────
  private renderCursor() {
    if (!this.assets) return
    const ctx = this.ctx
    const scale = getScale()
    const img = this.isGripping ? this.assets.ui.handGripping : this.assets.ui.handIdle
    if (!img) return
    const cw = 24 * scale, ch = 24 * scale
    ctx.drawImage(img, this.mouseX - 8 * scale, this.mouseY - 4 * scale, cw, ch)
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
    this.editText = this.inputEl.value.slice(0, CHAR_LIMIT)
  }

  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    this.mouseX = e.clientX
    this.mouseY = e.clientY
    try { this.canvas.setPointerCapture(e.pointerId) } catch { /**/ }

    if (this.state === 'LOADING') {
      this.handleLoadingClick(e)
    } else if (this.state === 'EDIT') {
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

  private onPointerMove = (e: PointerEvent) => {
    this.mouseX = e.clientX
    this.mouseY = e.clientY
    if (this.state === 'PLACING') this.handlePlacingMove(e)
    else if (this.isDraggingWall) this.continuePan(e)
  }

  private onPointerUp = (_e: PointerEvent) => {
    this.isGripping = false
    this.isDraggingNote = false
    const was = this.isDraggingWall
    this.isDraggingWall = false
    if (was) this.applyMomentum()
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
      } else if (name === 'leftArrow') {
        this.variantIndex = (this.variantIndex - 1 + NOTE_VARIANTS.length) % NOTE_VARIANTS.length
        this.syncInputToEditText()
      } else if (name === 'rightArrow') {
        this.variantIndex = (this.variantIndex + 1) % NOTE_VARIANTS.length
        this.syncInputToEditText()
      } else if (name === 'checkBtn') {
        this.spawnActiveNote()
        this.transitionTo('PLACING')
      }
      return
    }

    // Clicking anywhere else → focus hidden input for typing
    this.inputEl.value = this.editText
    this.inputEl.focus()
  }

  private syncInputToEditText() {
    // Keep editText in sync after variant change (text stays the same)
    this.inputEl.value = this.editText
  }

  private spawnActiveNote() {
    const scale = getScale()
    const variant = NOTE_VARIANTS[this.variantIndex]
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
      screenX, screenY,
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
      if (x >= screenX && x <= screenX+size && y >= screenY && y <= screenY+size) {
        this.isDraggingNote = true
        this.noteDragOffset = { x: x-screenX, y: y-screenY }
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
    this.activeNote.rotation = (Math.random() - 0.5) * 16
    this.activeNote.zIndex = ++this.globalZIndex
    this.savedNotes.push({ ...this.activeNote })
    this.transitionTo('SAVED')
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant: this.activeNote.variantKey,
          color:   this.activeNote.color,
          text:    this.activeNote.text,
          world_x: Math.round(this.activeNote.worldX),
          world_y: Math.round(this.activeNote.worldY),
          rotation: this.activeNote.rotation,
          z_index:  this.activeNote.zIndex,
        }),
      })
    } catch { /* offline — shown locally */ }
  }

  // ─── Load notes ────────────────────────────────────────────────────────────
  private async loadNotes() {
    try {
      const res  = await fetch('/api/notes')
      const data = await res.json()
      this.savedNotes = (data.notes || []).map((n: Record<string, unknown>) => ({
        id: n.id as string,
        variantKey: n.variant as string,
        color: n.color as 'yellow' | 'blue' | 'red',
        text:  n.text as string,
        worldX: n.world_x as number,
        worldY: n.world_y as number,
        rotation: n.rotation as number,
        zIndex:   n.z_index as number,
        screenX: 0, screenY: 0,
      }))
      this.globalZIndex = Math.max(0, ...this.savedNotes.map(n => n.zIndex))
    } catch { /* no backend yet */ }
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
    if (state === 'EDIT') {
      this.inputEl.value = this.editText
      // Small delay then focus so iOS keyboard opens
      setTimeout(() => { try { this.inputEl.focus() } catch { /**/ } }, 100)
    }
    this.state = state
  }
}
