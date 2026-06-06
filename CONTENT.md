# TONGUE.EXE — Full Project Context
### Continuation document for new Claude Code sessions
### Project by Michael Jones — independent artist, London

---

## WHAT THIS IS

A microsite for Michael Jones' single **"TONGUE"**. Users visit, create a pixel art sticky note
with a personal message, and place it permanently on an infinite scrollable wall.
The aesthetic is retro pixel art — Minecraft font, pixel shadows, hand cursor sprites.

**Live dev server:** `localhost:3001`
**Project root:** `/Users/michaeljones/Documents/THE WALL/tongue-exe/`
**Source assets:** `/Users/michaeljones/Documents/THE WALL/ASSETS/`

---

## HOW TO RUN

```bash
cd "/Users/michaeljones/Documents/THE WALL/tongue-exe"
npm run dev -- --port 3001    # dev
npm run build                  # production build check
```

---

## TECH STACK

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, shell only) |
| Rendering | Vanilla Canvas API — `lib/app.ts` is the entire app |
| Font | `minecraft.ttf` (only font used anywhere) |
| Backend | `/app/api/notes/route.ts` — in-memory + Supabase when env vars set |
| Deploy | Vercel — push to main triggers deploy |

**No React components do UI.** `app/page.tsx` mounts one `<canvas>` and calls `new TongueApp(canvas)`.

---

## FILE MAP

```
tongue-exe/
├── app/
│   ├── page.tsx              React shell — mounts canvas, starts TongueApp
│   ├── layout.tsx            Minimal layout, loads globals.css
│   ├── globals.css           @font-face minecraft.ttf, image-rendering: pixelated, body overflow hidden
│   └── api/notes/route.ts   GET/POST notes — in-memory fallback OR Supabase
├── lib/
│   ├── app.ts                ENTIRE APP — state machine, render loop, all input
│   ├── assets.ts             loadAllAssets() — loads images, precomputes shadow masks
│   ├── constants.ts          Colors, scale, world size, font constants
│   ├── shadow.ts             drawNoteShadow() — pixel-accurate 1px left+below shadows
│   ├── text.ts               renderNoteText() — fixed-size font, char-by-char wrapping
│   ├── types.ts              AppState, NoteData, Camera interfaces
│   └── variants.ts           NOTE_VARIANTS array — all 45 note variants + text zones
├── public/
│   ├── minecraft.ttf
│   ├── assets/notes/         45 PNG note sprites (yellow/blue/red × 15 shapes)
│   ├── assets/ui/            hand_idle, hand_gripping, x_button, tick_button, back_button, forward_button, textbox
│   ├── assets/loading/       loading_animation1.png → loading_animation13.png (72×24px frames)
│   └── assets/mini-mike/     sprite-0004.png → sprite-0007.png (128×128px, 4 frames)
├── .env.local                NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (gitignored)
└── CONTENT.md                this file
```

---

## STATE MACHINE (lib/app.ts)

```
LOADING  → auto-advance after 13 loading frames (~1s)
         → if from X button: loops forever, shows → top-right to return

EDIT     → note preview left, textbox right, ←/✓/→ arrows bottom-centre
         → type to add text (window keydown listener always active)
         → X top-left → LOADING (loop)
         → → top-right → VIEW_ONLY
         → ✓ → PLACING

PLACING  → wall background, draggable note, X top-left, ✓ top-right
         → drag note to position
         → ✓ → saves note to backend → SAVED
         → X → EDIT (discards note)

SAVED    → note locked with random rotation (-8°–+8°)
         → ← top-left → EDIT (create another note)

VIEW_ONLY → wall read-only, ← top-left → EDIT

DEEP_SCROLL → Mini Mike animation at bottom when scrolled 1960px below start
```

---

## CANVAS COORDINATE SYSTEM

- **World:** 10000×10000 1x units. Camera starts at world centre.
- **Scale:** `getScale()` = 2 on desktop (≥480px wide), 3 on mobile.
- **Note size on wall:** 48×48 sprite × scale = 96×96 CSS px at desktop.
- **Edit note preview:** `noteDisplayPx = min(floor(min(w,h)*0.38), 320)`. Positioned at left 8% of screen, vertically centred.
- **Rendering:** shadow → sprite → text, per note, in zIndex order.

---

## SHADOW SYSTEM (lib/shadow.ts + lib/assets.ts)

**Pixel-accurate — NOT CSS drop-shadow.**

At load time, `computeShadowMask(img)` scans each note sprite's alpha channel and builds:
- `leftEdge[]` — pixels where sprite is opaque but pixel-to-left is transparent
- `bottomEdge[]` — pixels where sprite is opaque but pixel-below is transparent

Stored as `Int16Array` pairs in `AssetStore.shadowMasks[variantKey]`.

At render time, `drawNoteShadow()` draws each shadow pixel at `1×scale` size.
Color is looked up from `SHADOW_MAP` in `constants.ts` based on what surface the shadow falls on.

Shadow direction: **1px LEFT + 1px BELOW** — no shadow on right or top.

---

## TEXT SYSTEM (lib/text.ts)

**Font never shrinks.** Always `FONT_MAX = 8px` at 1x × fontScale.

`renderNoteText(ctx, text, color, zone, noteX, noteY, posScale, fontScale?)`:
- `posScale` = scale for zone coordinate positioning (how big the note is on screen)
- `fontScale` = scale for font size. In edit preview: pass `getScale()` (=2) so font stays at wall size. On wall: pass `getScale()`.
- Uses `wrapByMeasure()` — character-by-character `ctx.measureText()` for accurate line breaks
- `ctx.clip()` enforces the zone as a hard boundary — text stops at zone edge

---

## NOTE VARIANTS (lib/variants.ts)

45 variants = 15 shapes × 3 colours (yellow/blue/red). Same shape = same text zone.

Text zones derived from **actual pixel alpha scans** of sprites:

| Variants | Shape | Zone |
|----------|-------|------|
| 1,8-14 | Flat/full body | `{x:2, y:16, w:43, h:31}` |
| 2 | Top-right large fold (rows 35+ fold) | `{x:2, y:16, w:43, h:18}` |
| 3 | Top-right medium fold (rows 40+) | `{x:2, y:16, w:43, h:23}` |
| 4 | Top-right small fold (rows 43+) | `{x:2, y:16, w:43, h:26}` |
| 5 | Bottom-left large fold (rows 35+) | `{x:2, y:16, w:43, h:18}` |
| 6 | Bottom-left medium fold (rows 38+) | `{x:2, y:16, w:43, h:21}` |
| 7 | Bottom-left small fold (rows 41+) | `{x:2, y:16, w:43, h:24}` |
| torn | Torn bottom (clean to row 37) | `{x:2, y:16, w:43, h:22}` |
| torn_2 | Torn top (clean from row 22) | `{x:2, y:22, w:43, h:24}` |

**Key measurements (1x Aseprite px, confirmed from pixel analysis):**
- Note sprite: 48×48px
- Header stripe rows 0–14 (darker shade) — text EXCLUDED from here
- Body rows 15–47 (lightest shade) — text lives here
- Text zone always starts at `y:16` (1px below header boundary)
- Width `w:43` = full body width minus 2px left margin + 3px right margin

---

## COLOURS

```
Wall background:        #8b93af
Wall shadow:            #6b7390
UI background (edit):   #ffffff
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
`window.addEventListener('keydown', onKeyDown)` — always fires regardless of focus.
`onKeyDown`: Backspace removes last char, printable keys append to `editText`.
**Critical:** do NOT focus `this.inputEl` from `handleEditClick` — that blocked `onKeyDown`.

### Mobile keyboard
Hidden `<input inputmode="text">` appended to document body, positioned off-screen.
`canvas.focus()` is called on EDIT state entry so canvas has focus for desktop.
`onNativeInput` handles the `input` event from the hidden element (mobile path).
Both paths sync `editText` and `inputEl.value`.

### Pointer events
`canvas.addEventListener('pointerdown', onPointerDown)` with `canvas.setPointerCapture(e.pointerId)`.
`window.addEventListener('pointermove', onPointerMove)` — catches events outside canvas.
`e.preventDefault()` only called for non-EDIT states.

---

## BACKEND (app/api/notes/route.ts)

Falls back to **in-memory** when Supabase env vars not set (notes lost on server restart).
Activates Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

**Rate limiting:** 3 notes per IP per hour (in-memory map, resets on server restart).

**Supabase SQL to run (in Supabase SQL editor):**
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

**To deploy:**
1. Create GitHub repo: `git remote add origin <url> && git push -u origin main`
2. Import to Vercel, set the two env vars above
3. Push main → auto-deploys

---

## KNOWN ISSUES / REMAINING WORK

### Text rendering
- Text on notes now uses pixel-accurate wrapping (`ctx.measureText` per char)
- Text stays at fixed `FONT_MAX` size, never shrinks
- If text appears too small on the note in edit, the `fontScale = getScale() = 2` is intentional — it matches what the note will look like on the wall

### Text zones
- Zones were derived from pixel scans of actual sprites
- Some folded variants may need zone tuning if text clips incorrectly
- All colours share the same zone (shapes are identical across colours)

### Loading screen
- Background: `#8b93af` (wall colour)
- Mini Mike animation plays in upper-centre
- Loading bar (13 frames) plays at 65% down the screen
- Auto-advances to EDIT after last frame + 400ms delay
- When triggered from X button: loops forever, shows → to return to EDIT

### Wall performance
- Only visible notes render shadows (bounding box check)
- Shadow mask precomputed at load time (not recalculated per frame)
- For 200+ visible notes: shadow calc skips notes below z-index threshold (not yet implemented)

### Mobile
- Hidden input triggers virtual keyboard
- Cursor sprites don't show on mobile (no mouse)
- Touch drag works via pointer events

### Not yet done
- Supabase wiring (schema above, env vars needed)
- GitHub push (committed locally, remote not set)
- Deep scroll: Mini Mike shows at 1960px below start Y — needs user to scroll very far
- Note rotation only applies on confirm (not during drag)
- Browser focus inconsistency: if another browser element steals focus, typing may not work — clicking the canvas restores it

---

## GIT STATE

```bash
# Check commits
cd "/Users/michaeljones/Documents/THE WALL/tongue-exe"
git log --oneline

# Latest commits:
# 8da85c6  Fix: text input broken — inputEl.focus() blocked window keydown handler
# c6154f9  Fix: pixel-accurate text zones, correct wrapping, textbox margin
# 7ff9897  Fix: keyboard input reliable on all browsers
# 53cdacd  Fix: restore keyboard input (keydown listener was removed in rewrite)
# 9ba0116  Fix: accurate text wrapping, textbox centered, more line spacing
# 8a9d87d  Fix: text never shrinks — fixed size, clips at zone boundary
# 1c2e99f  Fix: pixel-accurate shadows, text input, loading screen, larger arrows
# 364db5a  Initial build: TONGUE.EXE interactive sticky note wall
```

No remote set yet. Push with:
```bash
git remote add origin https://github.com/CodeCreatorManMike/TONGUE-EXE.git
git push -u origin main
```

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

---

## ASSET FILENAMES (public/assets/)

### Notes (45 total = 15 variants × 3 colours)
```
yellow_sticky_note_1.png  → yellow_sticky_note_14.png  (no 9)
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
sprite-0004.png → sprite-0007.png                  128×128px each
```

---

*Generated: 2026-06-06 · TONGUE.EXE build · Michael Jones*
