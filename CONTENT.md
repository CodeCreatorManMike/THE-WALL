# TONGUE.EXE — Full Project Context
### Continuation document for new Claude Code sessions
### Project by Michael Jones — independent artist, London

---

## WHAT THIS IS

A microsite for Michael Jones' single **"TONGUE"**. Users visit, create a pixel art sticky note
with a personal message, and place it permanently on an infinite scrollable wall.
The aesthetic is retro pixel art — Minecraft font, pixel shadows, hand cursor sprites.

**Live site:** `https://the-wall-ten-eta.vercel.app`
**GitHub:** `https://github.com/CodeCreatorManMike/THE-WALL`
**Local dev server:** `localhost:3001`
**Project root:** `/Users/michaeljones/Documents/THE WALL/tongue-exe/`
**Source assets:** `/Users/michaeljones/Documents/THE WALL/ASSETS/`

---

## HOW TO RUN

```bash
cd "/Users/michaeljones/Documents/THE WALL/tongue-exe"
npm run dev -- --port 3001    # dev
npm run build                  # production build check
git add -A && git commit -m "message" && git push   # deploy via Vercel auto-deploy
```

---

## TECH STACK

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, shell only) |
| Rendering | Vanilla Canvas API — `lib/app.ts` is the entire app |
| Font | `minecraft.ttf` (only font used anywhere) |
| Backend | `/app/api/notes/route.ts` — in-memory + Supabase when env vars set |
| Database | Supabase (Postgres) — Project URL + anon key in `.env.local` |
| Analytics | `@vercel/analytics/next` — `<Analytics />` in `app/layout.tsx` |
| Deploy | Vercel — push to `main` triggers auto-deploy |

**No React components do UI.** `app/page.tsx` mounts one `<canvas>` with `touch-action:none`
and calls `new TongueApp(canvas)`.

---

## FILE MAP

```
tongue-exe/
├── app/
│   ├── page.tsx              React shell — canvas + TongueApp, touch-action:none
│   ├── layout.tsx            Layout, Viewport meta, Analytics, globals.css
│   ├── icon.png              Favicon — yellow_sticky_note_1.png (48×48)
│   ├── globals.css           @font-face minecraft.ttf, image-rendering:pixelated
│   └── api/notes/route.ts   GET/POST notes — in-memory fallback OR Supabase
├── lib/
│   ├── app.ts                ENTIRE APP — state machine, render loop, all input
│   ├── assets.ts             loadAllAssets() — loads images, shadow masks, mini mike
│   ├── constants.ts          Colors, scale, world size, font, mini mike constants
│   ├── shadow.ts             drawNoteShadow() — pixel-accurate 1px left+below shadows
│   ├── text.ts               renderNoteText() — fixed-size font, char-by-char wrapping
│   ├── types.ts              AppState, NoteData, Camera interfaces
│   └── variants.ts           NOTE_VARIANTS — 45 variants + text zones (y:15, h:33 for full)
├── public/
│   ├── minecraft.ttf
│   ├── assets/notes/         45 PNG note sprites (yellow/blue/red × 15 shapes)
│   ├── assets/ui/            hand_idle, hand_gripping, x_button, tick_button,
│   │                         back_button, forward_button, textbox (109×96px)
│   ├── assets/loading/       loading_animation1.png → 13.png (72×24px frames)
│   └── assets/mini-mike/     mini-mike-1.png → mini-mike-6.png (128×128px, 6 frames)
├── .env.local                NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (gitignored)
└── CONTENT.md                this file
```

---

## STATE MACHINE (lib/app.ts)

```
LOADING   → Mini Mike animation + loading bar (13 frames, ~1s)
          → auto-advance to EDIT after last frame + 400ms
          → if from X button: loops forever, shows → top-right to return

EDIT      → note preview left, textbox right, ←/✓/→ arrows bottom-centre
          → wall background colour (#8b93af) — mirrors the placement screen
          → edit layout centred horizontally as a note+textbox block
          → X top-left → LOADING (loop)
          → → top-right → VIEW_ONLY
          → ✓ → PLACING
          → cameraZoom resets to 1.0 on entry

PLACING   → wall background, draggable active note, X top-left, ✓ top-right
          → cameraZoom resets to 1.0 on entry — notes always placed at normal size
          → drag note to position (touch: 6×scale px hit padding for finger precision)
          → ✓ → saves to Supabase → SAVED (rotation always 0)
          → X → EDIT (discards note)

SAVED     → note locked at placed position, no rotation, pixel-accurate shadow
          → pinch-to-zoom enabled (0.25× – 4×), two-finger pan still works
          → ← top-left → EDIT (create another note)

VIEW_ONLY → wall read-only, ← top-left → EDIT
          → pinch-to-zoom enabled (0.25× – 4×)
          → notes polled every 30s — shared live wall

DEEP_SCROLL → no longer implemented (Mini Mike deep-scroll removed)
```

---

## CANVAS COORDINATE SYSTEM

- **World:** 10000×10000 1x units. Camera starts at world centre.
- **Base scale:** `getScale()` = 2 on desktop (≥480px wide), 3 on mobile.
- **Effective scale:** `getScale() * cameraZoom` — used for all wall rendering.
  In EDIT/PLACING `cameraZoom = 1.0` always. In SAVED/VIEW_ONLY user can pinch.
- **Note size on wall at 1× zoom:** 48×48 sprite × getScale() = 96×96 CSS px desktop.
- **Edit note preview:** centred as a block with textbox; `noteDisplayPx = min(floor(min(w,h)*0.38), 320)`.
- **Rendering:** shadow → sprite → text, per note, in zIndex order.

---

## PINCH-TO-ZOOM (lib/app.ts)

Available in **SAVED** and **VIEW_ONLY** states only.

- Two-finger pinch: zoom 0.25× – 4×
- World point under pinch centre stays fixed (same feel as Maps)
- `activePointers` Map tracks each touch by `pointerId`
- On 2nd finger down: wall pan cancelled, `pinchStartDist` + `pinchStartZoom` recorded
- On `pointermove` with 2 pointers: `handlePinchMove()` recalculates `cameraZoom` and adjusts camera
- On `transitionTo('EDIT')` or `transitionTo('PLACING')`: `cameraZoom = 1.0`, `activePointers.clear()`
- Cursor rendering uses `getScale()` (not effectiveScale) so the hand sprite stays the same CSS size

---

## SHADOW SYSTEM (lib/shadow.ts + lib/assets.ts)

**Pixel-accurate — NOT CSS drop-shadow.**

At load time, `computeShadowMask(img)` scans each note sprite's alpha channel and builds:
- `leftEdge[]` — pixels where sprite is opaque but pixel-to-left is transparent
- `bottomEdge[]` — pixels where sprite is opaque but pixel-below is transparent

Stored as `Int16Array` pairs in `AssetStore.shadowMasks[variantKey]`.

At render time, `drawNoteShadow()` draws each shadow pixel at `1×scale` size.
Color is looked up from `SHADOW_MAP` in `constants.ts` based on surface under shadow.

Shadow direction: **1px LEFT + 1px BELOW** — no shadow on right or top.

**Note rotation is always 0.** Shadows always align correctly.
The old random rotation on confirm was removed — it caused shadow misalignment.

---

## TEXT SYSTEM (lib/text.ts)

**Font never shrinks.** Always `FONT_MAX = 8px` at 1x × fontScale.

`renderNoteText(ctx, text, color, zone, noteX, noteY, posScale, fontScale?)`:
- `posScale` = scale for zone coordinate positioning
- `fontScale` = scale for font size. In edit preview: `getScale()` (=2). On wall: `getScale() * cameraZoom`.
- `lineH = FONT_MAX * fs` (no extra gap) — fits **4 lines** in the full body zone
- Uses `wrapByMeasure()` — character-by-character `ctx.measureText()` for accurate line breaks
- `ctx.clip()` enforces the zone as a hard boundary

---

## NOTE VARIANTS (lib/variants.ts)

45 variants = 15 shapes × 3 colours (yellow/blue/red).

Text zones start at **y:15** (first body row, immediately after header boundary):

| Variants | Shape | Zone |
|----------|-------|------|
| 1,8-14 | Flat/full body | `{x:2, y:15, w:43, h:33}` |
| 2 | Top-right large fold | `{x:2, y:15, w:43, h:19}` |
| 3 | Top-right medium fold | `{x:2, y:15, w:43, h:24}` |
| 4 | Top-right small fold | `{x:2, y:15, w:43, h:27}` |
| 5 | Bottom-left large fold | `{x:2, y:15, w:43, h:19}` |
| 6 | Bottom-left medium fold | `{x:2, y:15, w:43, h:22}` |
| 7 | Bottom-left small fold | `{x:2, y:15, w:43, h:25}` |
| torn | Torn bottom | `{x:2, y:15, w:43, h:23}` |
| torn_2 | Torn top | `{x:2, y:22, w:43, h:24}` |

**Key measurements (1x Aseprite px):**
- Note sprite: 48×48px
- Header stripe rows 0–14 (darker shade) — text excluded
- Body rows 15–47 — text starts at y:15, h:33 = full body
- At 2× scale (desktop): zone is 86×66px → 4 lines at FONT_MAX*2=16px lineH

---

## COLOURS

```
Wall background:        #8b93af
Wall shadow:            #6b7390
Edit background:        #8b93af  (matches wall — mirrors placement screen)
UI shadow (on white):   #dae0ea

Yellow note base:       #ffd860  header: #f7b23b
Blue note base:         #a1d5e6  header: #82b5d9
Red note base:          #ef462e  header: #f01b0f

Text on yellow/blue:    #1a1008 (dark warm brown)
Text on red:            #ffffff (white)
```

---

## INPUT SYSTEM

### Desktop keyboard
`window.addEventListener('keydown', onKeyDown)` fires for all key events.
`onKeyDown`: if `this.isTouch` is true → skip character processing (prevents doubling).
Backspace removes last char, printable keys append to `editText`, then `inputEl.value` synced.

### Mobile keyboard (iOS-safe implementation)
**Critical rules iOS requires:**
1. `.focus()` must be called **synchronously inside a `touchend` handler** — never setTimeout, Promise, or rAF
2. Hidden input must be `position:fixed; top:-9999px` (NOT `display:none` or `visibility:hidden`)
3. `font-size: 16px` on input prevents iOS viewport zoom on focus
4. Nothing may call `.blur()` or steal focus after `.focus()` is called

**Implementation:**
- `onTouchEndKeyboard` — dedicated `touchend` listener on canvas (`passive:false`)
  - Checks if touch lands within `editTextboxRect`
  - Calls `inputEl.focus()` synchronously → keyboard opens and stays
- `onKeyDown` returns early if `this.isTouch` — prevents character doubling
- Backspace handled explicitly in `onKeyDown` even on touch (iOS `input` event unreliable for deletions)
- `canvas.focus()` only called on non-touch devices (prevents stealing focus from inputEl)
- The `transitionTo('EDIT')` no longer has a `setTimeout(canvas.focus)` — that was killing the keyboard

### Mobile drag / touch-action
Canvas has `touchAction: 'none'` in page.tsx — without this the browser intercepts gestures
for scroll before our pointer handlers see them. This fixes note dragging on mobile.

### Pointer events
- `canvas.addEventListener('pointerdown', onPointerDown)` with `canvas.setPointerCapture(e.pointerId)`
- `window.addEventListener('pointermove', onPointerMove)` — catches events outside canvas
- `activePointers` Map tracks all live pointers for pinch detection
- `e.preventDefault()` called for all non-EDIT states

### Cursor (mobile)
Hand sprite hotspot: `(8, 4)` on desktop, `(8, 12)` on touch.
`isTouch` set on first `pointerdown` with `pointerType === 'touch'` and stays true.
On mobile, cursor is raised so visual fingertip aligns with tap point.

---

## LOADING SCREEN

- Background: `#8b93af` (wall colour)
- **Mini Mike animation** — 6 frames (`mini-mike-1.png` → `mini-mike-6.png`, 128×128px each)
  - Plays in upper area (~28% from top)
  - Scale capped to 80% of screen width (prevents overflow on narrow phones)
- **Loading bar** — 13 frames (`loading_animation1-13.png`, 72×24px each)
  - Plays at ~62% down the screen
  - Scale capped to 80% of screen width
- Auto-advances to EDIT after last frame + 400ms delay
- When triggered from X button: loops forever, shows → top-right to return to EDIT

**Mini Mike is loading-screen only.** Deep-scroll mini mike was removed.

---

## BACKEND (app/api/notes/route.ts)

Falls back to **in-memory** when Supabase env vars not set (notes lost on server restart).
Activates **Supabase** when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

**Rate limiting:** 3 notes per IP per hour.

**Supabase project:** `https://nximyyvhuahmpufvsswc.supabase.co`

**Live polling:** `window.setInterval(() => loadNotes(), 30_000)` — all users see new notes within 30s.

**Supabase schema (already deployed):**
```sql
CREATE TABLE notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant     TEXT NOT NULL,
  color       TEXT NOT NULL CHECK (color IN ('yellow','blue','red')),
  text        TEXT NOT NULL CHECK (char_length(text) <= 24),
  world_x     INTEGER NOT NULL,
  world_y     INTEGER NOT NULL,
  rotation    REAL NOT NULL DEFAULT 0,
  z_index     INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read"   ON notes FOR SELECT USING (true);
CREATE POLICY "anyone can insert" ON notes FOR INSERT WITH CHECK (true);
```

**To reset the wall (delete all notes):**
```sql
DELETE FROM notes;
-- or TRUNCATE TABLE notes; (faster, resets sequences)
```

---

## GIT STATE

```bash
cd "/Users/michaeljones/Documents/THE WALL/tongue-exe"
git log --oneline

# Recent commits:
# 2c8a514  Add pinch-to-zoom on wall (VIEW_ONLY / SAVED states only)
# 09c3961  Fix mobile backspace: handle explicitly in onKeyDown, not via input event
# 08c6bd6  Fix mobile double-input: use isTouch flag instead of activeElement check
# 637ebd1  Fix iOS keyboard: synchronous touchend focus, remove async blur sources
# 346b90a  Fix mobile keyboard, touch drag, and add sticky note favicon
# b269722  Fix mobile cursor hotspot — raise hand sprite on touch
# 44c18dc  Fix double character input on mobile keyboard
# 132d145  Fix mobile loading screen, keyboard input, and edit layout centering
# 0672b18  Polish UI, fix text zones, and prep for deployment
```

Remote: `https://github.com/CodeCreatorManMike/THE-WALL.git`
Vercel auto-deploys on push to `main`.

---

## QUICK "WHERE IS X?"

| Goal | Location |
|------|----------|
| Change note text zone | `lib/variants.ts` — TextZone objects at top |
| Change font size | `lib/constants.ts` — `FONT_MAX` (currently 8) |
| Change loading screen | `lib/app.ts` — `renderLoading()` |
| Change edit layout | `lib/app.ts` — `renderEdit()` |
| Add/change note variant | `lib/variants.ts` — add to `NOTE_VARIANTS` array |
| Shadow colours | `lib/constants.ts` — `SHADOW_MAP` |
| Wall background colour | `lib/constants.ts` — `COLOR_WALL_BG` |
| Note colours | `lib/constants.ts` — `NOTE_BASE_COLORS`, `NOTE_HEADER_COLORS` |
| Button sizes | `lib/app.ts` — `btnS` calculations in `renderEdit` and `renderWallUI` |
| Text in textbox widget | `lib/app.ts` — `renderTextboxText()` |
| Supabase | `lib/supabase.ts`, `app/api/notes/route.ts`, `.env.local` |
| Pinch zoom limits | `lib/app.ts` — `handlePinchMove()` — `Math.max(0.25, Math.min(4.0, ...))` |
| Mobile keyboard | `lib/app.ts` — `onTouchEndKeyboard()`, `onKeyDown()` (isTouch guard) |
| Cursor hotspot | `lib/app.ts` — `renderCursor()` — `hotY = isTouch ? 12*scale : 4*scale` |
| Mini Mike frames | `public/assets/mini-mike/mini-mike-1.png` → `mini-mike-6.png` |
| Loading bar frames | `public/assets/loading/loading_animation1.png` → `13.png` |
| Favicon | `app/icon.png` (Next.js App Router picks this up automatically) |

---

## ASSET FILENAMES (public/assets/)

### Notes (45 total = 15 variants × 3 colours)
```
yellow_sticky_note_1.png  → yellow_sticky_note_14.png  (no _9)
yellow_sticky_note_torn.png
yellow_sticky_note_torn_2.png
(same pattern for blue_ and red_)
```

### UI
```
hand_idle.png       24×24px — open hand cursor
hand_gripping.png   24×24px — closed fist cursor
x_button.png        8×8px sprite
tick_button.png     8×8px sprite
back_button.png     8×8px sprite (left arrow)
forward_button.png  8×8px sprite (right arrow)
textbox.png         109×96px notepad widget
```

### Loading / Mini Mike
```
loading_animation1.png → loading_animation13.png   72×24px each
mini-mike-1.png → mini-mike-6.png                  128×128px each
```

---

*Updated: 2026-06-06 · TONGUE.EXE · Michael Jones — independent artist, London*
