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

  // State
  private state: AppState = 'LOADING'

  // Loading animation
  private loadingFrame = 0
  private loadingLastTick = 0
  private loadingComplete = false
  private loadingIsLoop = false    // true when looping from X button (never auto-advances)

  // Mini Mike
  private mikeyFrame = 0
  private mikeyLastTick = 0

  // Edit state
  private variantIndex = 0
  private editText = ''
  private cursorVisible = true
  private cursorLastBlink = 0
  private textInputActive = false

  // Wall
  private camera: Camera = { x: 0, y: 0 }
  private savedNotes: NoteData[] = []
  private activeNote: NoteData | null = null
  private globalZIndex = 0

  // Drag
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
  }

  async start() {
    this.resize()
    window.addEventListener('resize', this.resize)
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('keydown', this.onKeyDown)

    this.assets = await loadAllAssets()
    this.ready = true

    // Centre camera on world
    this.camera.x = WORLD_SIZE / 2 - CANVAS_W / 2
    this.camera.y = WORLD_SIZE / 2 - CANVAS_H / 2

    // Load saved notes from backend
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
    window.removeEventListener('keydown', this.onKeyDown)
  }

  // ─── Resize ────────────────────────────────────────────────────────────────
  private resize = () => {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.ctx.imageSmoothingEnabled = false
  }

  // ─── Main loop ─────────────────────────────────────────────────────────────
  private loop = (now: number) => {
    if (this.destroyed) return
    this.rafId = requestAnimationFrame(this.loop)
    this.ctx.imageSmoothingEnabled = false
    this.render(now)
  }

  // ─── Render dispatcher ─────────────────────────────────────────────────────
  private render(now: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)

    if (!this.ready) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      return
    }

    if (this.state === 'LOADING') this.renderLoading(now)
    else if (this.state === 'EDIT') this.renderEdit(now)
    else this.renderWall(now)

    // Always draw cursor on top
    this.renderCursor()
  }

  // ─── LOADING ───────────────────────────────────────────────────────────────
  private renderLoading(now: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    const scale = getScale()
    const frames = this.assets.loading
    if (!frames.length) return

    // Tick frame
    const interval = 1000 / LOADING_FPS
    if (now - this.loadingLastTick > interval) {
      this.loadingLastTick = now
      if (this.loadingFrame < frames.length - 1) {
        this.loadingFrame++
      } else if (this.loadingIsLoop) {
        // Loop mode — restart animation indefinitely
        this.loadingFrame = 0
      } else if (!this.loadingComplete) {
        this.loadingComplete = true
        setTimeout(() => this.transitionTo('EDIT'), 300)
      }
    }

    // Draw loading frame centred
    const frame = frames[this.loadingFrame]
    const fw = frame.naturalWidth * scale
    const fh = frame.naturalHeight * scale
    const fx = Math.floor((w - fw) / 2)
    const fy = Math.floor((h - fh) / 2)
    ctx.drawImage(frame, fx, fy, fw, fh)

    // In loop mode: show right-arrow top-right to return to EDIT
    if (this.loadingIsLoop) {
      const btnS = Math.floor(8 * scale)
      const edge = BORDER * scale
      const bx = w - edge - btnS
      const by = edge
      drawUIShadow(ctx, bx, by, btnS, btnS, '#6b7390')
      ctx.drawImage(this.assets.ui.forwardButton, bx, by, btnS, btnS)
      this.loadingButtons = { fwBtn: { x: bx, y: by, w: btnS, h: btnS } }
    }
  }

  // ─── EDIT ──────────────────────────────────────────────────────────────────
  private renderEdit(now: number) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    // Full-viewport white background — no boxes, no borders
    ctx.fillStyle = COLOR_UI_BG
    ctx.fillRect(0, 0, w, h)

    const variant = NOTE_VARIANTS[this.variantIndex]

    // ── Note preview ──────────────────────────────────────────────────────────
    // Size: fill ~38% of the smaller screen dimension, capped to look good
    const noteDisplayPx = Math.min(Math.floor(Math.min(w, h) * 0.38), 320)
    const noteW = noteDisplayPx
    const noteH = noteDisplayPx
    const noteScale = noteDisplayPx / 48   // posScale for zone coords

    // Position: left 42% of screen, vertically centered
    const noteX = Math.floor(w * 0.08)
    const noteY = Math.floor(h / 2 - noteH / 2)

    // Note shadow (only the note gets a shadow per spec — no shadow on textbox/buttons)
    drawUIShadow(ctx, noteX, noteY, noteW, noteH, COLOR_UI_SHADOW)
    const sprite = this.assets.notes[variant.key]
    if (sprite) ctx.drawImage(sprite, noteX, noteY, noteW, noteH)

    // Text: positioned using noteScale (correct zone coords), font at wall scale
    renderNoteText(ctx, this.editText, variant.color, variant.zone, noteX, noteY, noteScale, getScale())

    // ── Textbox ───────────────────────────────────────────────────────────────
    // Scale: match note height proportionally (textbox sprite is 109×96 at 1x)
    const tbScale = noteDisplayPx / 96   // scale so textbox is ~same height as note
    const tbW = Math.floor(109 * tbScale)
    const tbH = Math.floor(96 * tbScale)
    // Position: right of note with a gap, vertically centered
    const tbX = noteX + noteW + Math.floor(w * 0.06)
    const tbY = Math.floor(h / 2 - tbH / 2)

    // No shadow on textbox — sprite has its own border
    if (this.assets.ui.textbox) ctx.drawImage(this.assets.ui.textbox, tbX, tbY, tbW, tbH)
    this.renderTextboxText(ctx, tbX, tbY, tbW, tbH, tbScale)

    // ── Buttons ───────────────────────────────────────────────────────────────
    // Large enough to click/tap comfortably: 32px minimum
    const btnS = Math.max(32, Math.floor(Math.min(w, h) * 0.04))
    const edge = Math.max(20, Math.floor(w * 0.025))

    // X — top-left
    const xBtnX = edge
    const xBtnY = edge
    ctx.drawImage(this.assets.ui.xButton, xBtnX, xBtnY, btnS, btnS)

    // → view wall — top-right
    const fwBtnX = w - edge - btnS
    const fwBtnY = edge
    ctx.drawImage(this.assets.ui.forwardButton, fwBtnX, fwBtnY, btnS, btnS)

    // Bottom row: ← ✓ → centred under the note
    const noteCentreX = noteX + Math.floor(noteW / 2)
    const bottomY = noteY + noteH + Math.max(16, Math.floor(h * 0.03))
    const gap = btnS + Math.floor(btnS * 0.6)

    const leftArrowX  = noteCentreX - gap - btnS
    const checkX      = noteCentreX - Math.floor(btnS / 2)
    const rightArrowX = noteCentreX + gap

    ctx.drawImage(this.assets.ui.backButton,    leftArrowX,  bottomY, btnS, btnS)
    ctx.drawImage(this.assets.ui.tickButton,    checkX,      bottomY, btnS, btnS)
    ctx.drawImage(this.assets.ui.forwardButton, rightArrowX, bottomY, btnS, btnS)

    // Store hit areas — add generous padding for easier clicking
    const pad = Math.floor(btnS * 0.3)
    this.editButtons = {
      xBtn:       { x: xBtnX - pad,       y: xBtnY - pad,   w: btnS + pad*2, h: btnS + pad*2 },
      fwBtn:      { x: fwBtnX - pad,      y: fwBtnY - pad,  w: btnS + pad*2, h: btnS + pad*2 },
      leftArrow:  { x: leftArrowX - pad,  y: bottomY - pad, w: btnS + pad*2, h: btnS + pad*2 },
      checkBtn:   { x: checkX - pad,      y: bottomY - pad, w: btnS + pad*2, h: btnS + pad*2 },
      rightArrow: { x: rightArrowX - pad, y: bottomY - pad, w: btnS + pad*2, h: btnS + pad*2 },
    }

    // Cursor blink
    if (now - this.cursorLastBlink > 500) {
      this.cursorVisible = !this.cursorVisible
      this.cursorLastBlink = now
    }
  }

  private renderTextboxText(
    ctx: CanvasRenderingContext2D,
    tbX: number, tbY: number, tbW: number, tbH: number,
    _scale: number
  ) {
    // Confirmed pixel analysis (109×96 sprite):
    //   x: content 12–98 (86px wide)
    //   rows 17: top border
    //   rows 18–28: red header
    //   row  29: divider
    //   rows 30–77: white body
    //   ruled lines at 1x rows: 38,45,51,57,63,69
    //   line spacing: ~6.5px at 1x
    const textStartX = tbX + Math.floor((14 / 109) * tbW)
    const textWidth  = Math.floor((82 / 109) * tbW)
    // First text line sits just above ruled line at row 38
    const firstLineY = tbY + Math.floor((32 / 96) * tbH)
    // Line height derived from ruled line spacing (6.5px at 1x)
    const lineH = Math.floor((6.5 / 96) * tbH)
    const bodyBottom = tbY + Math.floor((77 / 96) * tbH)

    // Font size: use the line height to fill each ruled gap nicely
    const fontSize = Math.max(5, lineH - 2)
    const charW = Math.ceil(fontSize * 0.6) + 1
    const perLine = Math.max(1, Math.floor(textWidth / charW))
    const maxLines = 6   // 6 writable lines (line 7 is the bottom border)

    const lines: string[] = []
    let current = ''
    for (const ch of this.editText) {
      if (current.length >= perLine) { lines.push(current); current = ch }
      else current += ch
    }
    if (current) lines.push(current)

    ctx.save()
    ctx.font = `${fontSize}px minecraft`
    ctx.fillStyle = '#1a1008'
    ctx.textBaseline = 'top'
    ctx.imageSmoothingEnabled = false

    // Clip to body area
    ctx.beginPath()
    ctx.rect(textStartX, firstLineY, textWidth, bodyBottom - firstLineY)
    ctx.clip()

    lines.slice(0, maxLines).forEach((line, i) => {
      const drawY = firstLineY + i * lineH
      if (drawY + fontSize <= bodyBottom) {
        ctx.fillText(line, textStartX, drawY)
      }
    })

    // Blinking cursor
    if (this.textInputActive && this.cursorVisible) {
      const lastIdx = Math.min(lines.length - 1, maxLines - 1)
      const lastLine = lines[lastIdx] || ''
      const cx = textStartX + lastLine.length * charW
      const cy = firstLineY + lastIdx * lineH
      ctx.fillRect(cx, cy, Math.max(1, Math.ceil(tbW / 109)), fontSize)
    }

    ctx.restore()
  }

  // ─── WALL (PLACING / SAVED / VIEW_ONLY) ───────────────────────────────────
  private renderWall(now: number) {
    const ctx = this.ctx
    const scale = getScale()
    const w = this.canvas.width
    const h = this.canvas.height

    // Wall background
    ctx.fillStyle = COLOR_WALL_BG
    ctx.fillRect(0, 0, w, h)

    // Update screen coords for all notes
    const allNotes = this.getAllNotes()
    for (const note of allNotes) {
      note.screenX = Math.floor((note.worldX - this.camera.x) * scale)
      note.screenY = Math.floor((note.worldY - this.camera.y) * scale)
    }

    // Sort by zIndex
    const sorted = [...allNotes].sort((a, b) => a.zIndex - b.zIndex)

    // Draw notes (shadow first, then sprite, then text)
    for (const note of sorted) {
      if (!this.isNoteVisible(note, scale)) continue
      this.drawNote(ctx, note, sorted, scale)
    }

    // Deep scroll animation
    this.maybeDrawMiniMike(ctx, now, scale)

    // UI overlay
    this.renderWallUI(ctx, scale)
  }

  private drawNote(
    ctx: CanvasRenderingContext2D,
    note: NoteData,
    allNotes: NoteData[],
    scale: number
  ) {
    const { screenX: sx, screenY: sy } = note
    const sw = 48 * scale
    const sh = 48 * scale

    // Shadow is always axis-aligned (no rotation)
    drawNoteShadow(ctx, note, allNotes, scale)

    const sprite = this.assets.notes[note.variantKey]
    const variant = NOTE_VARIANTS.find(v => v.key === note.variantKey)

    ctx.save()
    if (note.rotation) {
      // Rotate around note centre
      ctx.translate(sx + sw / 2, sy + sh / 2)
      ctx.rotate((note.rotation * Math.PI) / 180)
      if (sprite) ctx.drawImage(sprite, -sw / 2, -sh / 2, sw, sh)
      if (variant) renderNoteText(ctx, note.text, note.color, variant.zone, -sw / 2, -sh / 2, scale)
    } else {
      if (sprite) ctx.drawImage(sprite, sx, sy, sw, sh)
      if (variant) renderNoteText(ctx, note.text, note.color, variant.zone, sx, sy, scale)
    }
    ctx.restore()
  }

  private renderWallUI(ctx: CanvasRenderingContext2D, _scale: number) {
    const w = this.canvas.width
    const h = this.canvas.height
    const btnS = Math.max(32, Math.floor(Math.min(w, h) * 0.04))
    const edge = Math.max(20, Math.floor(w * 0.025))
    const pad = Math.floor(btnS * 0.3)

    if (this.state === 'PLACING') {
      const xX = edge, xY = edge
      const ckX = w - edge - btnS, ckY = edge
      ctx.drawImage(this.assets.ui.xButton, xX, xY, btnS, btnS)
      ctx.drawImage(this.assets.ui.tickButton, ckX, ckY, btnS, btnS)
      this.wallButtons = {
        xBtn:     { x: xX - pad,  y: xY - pad,  w: btnS + pad*2, h: btnS + pad*2 },
        checkBtn: { x: ckX - pad, y: ckY - pad, w: btnS + pad*2, h: btnS + pad*2 },
      }
    } else if (this.state === 'SAVED') {
      const bkX = edge, bkY = edge
      ctx.drawImage(this.assets.ui.backButton, bkX, bkY, btnS, btnS)
      this.wallButtons = { backBtn: { x: bkX - pad, y: bkY - pad, w: btnS + pad*2, h: btnS + pad*2 } }
    } else if (this.state === 'VIEW_ONLY') {
      const laX = edge, laY = edge
      ctx.drawImage(this.assets.ui.backButton, laX, laY, btnS, btnS)
      this.wallButtons = { leftArrow: { x: laX - pad, y: laY - pad, w: btnS + pad*2, h: btnS + pad*2 } }
    }
  }

  private maybeDrawMiniMike(ctx: CanvasRenderingContext2D, now: number, scale: number) {
    // Camera starts at world center. Deep scroll triggers after scrolling
    // DEEP_SCROLL_TRIGGER units below the starting camera position.
    const cameraStartY = WORLD_SIZE / 2 - CANVAS_H / 2
    const scrolledDown = this.camera.y - cameraStartY
    if (scrolledDown < DEEP_SCROLL_TRIGGER) return

    const frames = this.assets.miniMike
    if (!frames.length) return

    const interval = 1000 / MINI_MIKE_FPS
    if (now - this.mikeyLastTick > interval) {
      this.mikeyLastTick = now
      this.mikeyFrame = (this.mikeyFrame + 1) % frames.length
    }

    const frame = frames[this.mikeyFrame]
    // Mini Mike sprites are 128×128 — render at 2× scale
    const fw = Math.floor(frame.naturalWidth * scale)
    const fh = Math.floor(frame.naturalHeight * scale)

    // Anchored to world position below start point
    const worldY = cameraStartY + DEEP_SCROLL_TRIGGER + CANVAS_H
    const screenY = Math.floor((worldY - this.camera.y) * scale)
    const screenX = Math.floor(this.canvas.width / 2 - fw / 2)

    ctx.drawImage(frame, screenX, screenY, fw, fh)
  }

  // ─── Cursor ────────────────────────────────────────────────────────────────
  private renderCursor() {
    const ctx = this.ctx
    const scale = getScale()
    const img = this.isGripping ? this.assets?.ui?.handGripping : this.assets?.ui?.handIdle
    if (!img) return
    const cw = 24 * scale
    const ch = 24 * scale
    // Hotspot at (8,4) 1x = (8*scale, 4*scale)
    const cx = this.mouseX - 8 * scale
    const cy = this.mouseY - 4 * scale
    ctx.drawImage(img, cx, cy, cw, ch)
  }

  // ─── Hit test helpers ──────────────────────────────────────────────────────
  private editButtons: Record<string, { x: number; y: number; w: number; h: number }> = {}
  private wallButtons: Record<string, { x: number; y: number; w: number; h: number }> = {}
  private loadingButtons: Record<string, { x: number; y: number; w: number; h: number }> = {}

  private hitTest(x: number, y: number, rect: { x: number; y: number; w: number; h: number }) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  private isNoteVisible(note: NoteData, scale: number): boolean {
    const { screenX, screenY } = note
    const size = 48 * scale
    const pad = size * 2
    return (
      screenX > -pad && screenX < this.canvas.width + pad &&
      screenY > -pad && screenY < this.canvas.height + pad
    )
  }

  private isInBorderZone(screenX: number, screenY: number, scale: number): boolean {
    const b = BORDER * scale
    const sw = 48 * scale
    const sh = 48 * scale
    return (
      screenX < b ||
      screenY < b ||
      screenX + sw > this.canvas.width - b ||
      screenY + sh > this.canvas.height - b
    )
  }

  // ─── Input ─────────────────────────────────────────────────────────────────
  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    this.mouseX = e.clientX
    this.mouseY = e.clientY
    // Capture pointer so move/up fire even outside canvas
    try { this.canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }

    if (this.state === 'LOADING') this.handleLoadingClick(e)
    else if (this.state === 'EDIT') this.handleEditClick(e)
    else if (this.state === 'PLACING') {
      this.isGripping = true
      this.handlePlacingDown(e)
    }
    else if (this.state === 'SAVED') {
      this.isGripping = true
      this.handleSavedClick(e)
    }
    else if (this.state === 'VIEW_ONLY') {
      this.isGripping = true
      this.handleViewOnlyClick(e)
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    this.mouseX = e.clientX
    this.mouseY = e.clientY

    if (this.state === 'PLACING') this.handlePlacingMove(e)
    else if ((this.state === 'SAVED' || this.state === 'VIEW_ONLY') && this.isDraggingWall) {
      this.continuePan(e)
    }
  }

  private onPointerUp = (_e: PointerEvent) => {
    this.isGripping = false
    this.isDraggingNote = false
    const wasDraggingWall = this.isDraggingWall
    this.isDraggingWall = false
    if (wasDraggingWall) this.applyMomentum()
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.state !== 'EDIT') return
    if (!this.textInputActive) {
      this.textInputActive = true
    }
    if (e.key === 'Backspace') {
      this.editText = this.editText.slice(0, -1)
    } else if (e.key.length === 1 && this.editText.length < CHAR_LIMIT) {
      this.editText += e.key
    }
  }

  // ─── Loading click handling ────────────────────────────────────────────────
  private handleLoadingClick(e: PointerEvent) {
    const { x, y } = { x: e.clientX, y: e.clientY }
    for (const [name, rect] of Object.entries(this.loadingButtons)) {
      if (this.hitTest(x, y, rect) && name === 'fwBtn') {
        this.loadingIsLoop = false
        this.transitionTo('EDIT')
        return
      }
    }
  }

  // ─── Edit click handling ───────────────────────────────────────────────────
  private handleEditClick(e: PointerEvent) {
    const { x, y } = { x: e.clientX, y: e.clientY }

    for (const [name, rect] of Object.entries(this.editButtons)) {
      if (!this.hitTest(x, y, rect)) continue
      if (name === 'xBtn') {
        this.loadingIsLoop = true
        this.transitionTo('LOADING')
      } else if (name === 'fwBtn') {
        this.transitionTo('VIEW_ONLY')
      } else if (name === 'leftArrow') {
        this.variantIndex = (this.variantIndex - 1 + NOTE_VARIANTS.length) % NOTE_VARIANTS.length
      } else if (name === 'rightArrow') {
        this.variantIndex = (this.variantIndex + 1) % NOTE_VARIANTS.length
      } else if (name === 'checkBtn') {
        this.spawnActiveNote()
        this.transitionTo('PLACING')
      }
      return
    }

    // Clicking anywhere else activates text input
    this.textInputActive = true
  }

  private spawnActiveNote() {
    const scale = getScale()
    const variant = NOTE_VARIANTS[this.variantIndex]
    const screenX = Math.floor(this.canvas.width / 2 - 24 * scale)
    const screenY = Math.floor(this.canvas.height / 2 - 24 * scale)
    this.activeNote = {
      variantKey: variant.key,
      color: variant.color,
      text: this.editText,
      worldX: screenX / scale + this.camera.x,
      worldY: screenY / scale + this.camera.y,
      rotation: 0,
      zIndex: this.globalZIndex + 1,
      screenX,
      screenY,
    }
  }

  // ─── Placing input ─────────────────────────────────────────────────────────
  private handlePlacingDown(e: PointerEvent) {
    const { x, y } = { x: e.clientX, y: e.clientY }

    // Check UI buttons first
    for (const [name, rect] of Object.entries(this.wallButtons)) {
      if (!this.hitTest(x, y, rect)) continue
      if (name === 'xBtn') {
        this.activeNote = null
        this.transitionTo('EDIT')
      } else if (name === 'checkBtn') {
        this.confirmNote()
      }
      return
    }

    // Check if clicking the active note
    if (this.activeNote) {
      const scale = getScale()
      const { screenX, screenY } = this.activeNote
      const size = 48 * scale
      if (x >= screenX && x <= screenX + size && y >= screenY && y <= screenY + size) {
        this.isDraggingNote = true
        this.isGripping = true
        this.noteDragOffset = { x: x - screenX, y: y - screenY }
        return
      }
    }

    // Pan wall
    this.isDraggingWall = true
    this.dragStart = { x, y }
    this.cameraStart = { ...this.camera }
    this.lastMovePos = { x, y }
    this.velocity = { x: 0, y: 0 }
  }

  private handlePlacingMove(e: PointerEvent) {
    const { x, y } = { x: e.clientX, y: e.clientY }
    const scale = getScale()

    if (this.isDraggingNote && this.activeNote) {
      const newSX = x - this.noteDragOffset.x
      const newSY = y - this.noteDragOffset.y
      if (!this.isInBorderZone(newSX, newSY, scale)) {
        this.activeNote.screenX = newSX
        this.activeNote.screenY = newSY
        this.activeNote.worldX = newSX / scale + this.camera.x
        this.activeNote.worldY = newSY / scale + this.camera.y
      }
    } else if (this.isDraggingWall) {
      this.velocity.x = (x - this.lastMovePos.x) / scale
      this.velocity.y = (y - this.lastMovePos.y) / scale
      this.lastMovePos = { x, y }
      const dx = (x - this.dragStart.x) / scale
      const dy = (y - this.dragStart.y) / scale
      this.camera.x = this.cameraStart.x - dx
      this.camera.y = this.cameraStart.y - dy
    }
  }

  private continuePan(e: PointerEvent) {
    const { x, y } = { x: e.clientX, y: e.clientY }
    const scale = getScale()
    this.velocity.x = (x - this.lastMovePos.x) / scale
    this.velocity.y = (y - this.lastMovePos.y) / scale
    this.lastMovePos = { x, y }
    const dx = (x - this.dragStart.x) / scale
    const dy = (y - this.dragStart.y) / scale
    this.camera.x = this.cameraStart.x - dx
    this.camera.y = this.cameraStart.y - dy
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
    const { x, y } = { x: e.clientX, y: e.clientY }
    for (const [name, rect] of Object.entries(this.wallButtons)) {
      if (this.hitTest(x, y, rect) && name === 'backBtn') {
        this.activeNote = null
        this.editText = ''
        this.textInputActive = false
        this.transitionTo('EDIT')
        return
      }
    }
    // Start pan
    this.isDraggingWall = true
    this.dragStart = { x, y }
    this.cameraStart = { ...this.camera }
    this.lastMovePos = { x, y }
    this.velocity = { x: 0, y: 0 }
  }

  private handleViewOnlyClick(e: PointerEvent) {
    const { x, y } = { x: e.clientX, y: e.clientY }
    for (const [name, rect] of Object.entries(this.wallButtons)) {
      if (this.hitTest(x, y, rect) && name === 'leftArrow') {
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

  // ─── Confirm + save ────────────────────────────────────────────────────────
  private async confirmNote() {
    if (!this.activeNote) return
    const rotation = (Math.random() - 0.5) * 16
    this.activeNote.rotation = rotation
    this.activeNote.zIndex = ++this.globalZIndex
    this.savedNotes.push({ ...this.activeNote })
    this.transitionTo('SAVED')

    // POST to backend
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant: this.activeNote.variantKey,
          color: this.activeNote.color,
          text: this.activeNote.text,
          world_x: Math.round(this.activeNote.worldX),
          world_y: Math.round(this.activeNote.worldY),
          rotation: this.activeNote.rotation,
          z_index: this.activeNote.zIndex,
        }),
      })
    } catch {
      // offline — note is still displayed locally
    }
  }

  // ─── Load notes ────────────────────────────────────────────────────────────
  private async loadNotes() {
    try {
      const res = await fetch('/api/notes')
      const data = await res.json()
      const scale = getScale()
      this.savedNotes = (data.notes || []).map((n: Record<string, unknown>) => ({
        id: n.id as string,
        variantKey: n.variant as string,
        color: n.color as 'yellow' | 'blue' | 'red',
        text: n.text as string,
        worldX: n.world_x as number,
        worldY: n.world_y as number,
        rotation: n.rotation as number,
        zIndex: n.z_index as number,
        screenX: 0,
        screenY: 0,
      }))
      this.globalZIndex = Math.max(0, ...this.savedNotes.map(n => n.zIndex))
    } catch {
      // no backend yet — fine
    }
  }

  private getAllNotes(): NoteData[] {
    if (this.activeNote && (this.state === 'PLACING')) {
      return [...this.savedNotes, this.activeNote]
    }
    return this.savedNotes
  }

  // ─── Transitions ───────────────────────────────────────────────────────────
  private transitionTo(state: AppState) {
    if (state === 'LOADING') {
      this.loadingFrame = 0
      this.loadingComplete = false
      this.loadingLastTick = 0
    }
    this.state = state
  }
}
