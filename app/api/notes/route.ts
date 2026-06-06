import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

// ─── Supabase (active when env vars are set) ──────────────────────────────────
const HAS_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_project_url' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your_supabase_anon_key'
)

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── In-memory fallback ───────────────────────────────────────────────────────
const memNotes: Record<string, unknown>[] = []
let nextId = 1

// ─── Rate limit (IP, 10 per hour) ────────────────────────────────────────────
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const window = 60 * 60 * 1000
  const hits = (rateLimitMap.get(ip) || []).filter(t => now - t < window)
  if (hits.length >= 10) return true
  rateLimitMap.set(ip, [...hits, now])
  return false
}

// Max text length depending on item type
// blank notes allow 48 chars, everything else 24
function maxTextLen(variant: string): number {
  return variant.startsWith('blank_') ? 48 : 24
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  if (HAS_SUPABASE) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('z_index', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ notes: data ?? [] })
  }
  return NextResponse.json({
    notes: [...memNotes].sort((a, b) => (a.z_index as number) - (b.z_index as number))
  })
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const body = await req.json()
  const { variant, color, text, world_x, world_y, rotation, z_index, image_data } = body

  if (!variant || !color || typeof text !== 'string') {
    return NextResponse.json({ error: 'Invalid note data' }, { status: 400 })
  }

  const limit = maxTextLen(String(variant))
  if (text.length > limit) {
    return NextResponse.json({ error: `Text too long (max ${limit})` }, { status: 400 })
  }

  // image_data must be a base64 data URL or absent
  // Limit to ~200KB base64 (roughly 150KB image) to keep rows manageable
  if (image_data !== undefined && image_data !== null) {
    if (typeof image_data !== 'string') {
      return NextResponse.json({ error: 'Invalid image_data' }, { status: 400 })
    }
    if (image_data.length > 200_000) {
      return NextResponse.json({ error: 'Image too large' }, { status: 400 })
    }
  }

  const noteData: Record<string, unknown> = {
    variant:   String(variant).slice(0, 50),
    color:     String(color).slice(0, 30),
    text:      String(text).slice(0, limit),
    world_x:   Math.round(Number(world_x)) || 0,
    world_y:   Math.round(Number(world_y)) || 0,
    rotation:  Number(rotation) || 0,
    z_index:   Number(z_index) || 1,
    image_data: image_data ?? null,
  }

  if (HAS_SUPABASE) {
    const supabase = await getSupabase()
    const { data, error } = await supabase.from('notes').insert([noteData]).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ note: data })
  }

  const note = { id: String(nextId++), ...noteData, created_at: new Date().toISOString() }
  memNotes.push(note)
  return NextResponse.json({ note })
}
