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

// ─── Rate limit (IP, 3 per hour) ─────────────────────────────────────────────
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const window = 60 * 60 * 1000  // 1 hour
  const hits = (rateLimitMap.get(ip) || []).filter(t => now - t < window)
  if (hits.length >= 3) return true
  rateLimitMap.set(ip, [...hits, now])
  return false
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
  // Rate limiting
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit: max 3 notes per hour' }, { status: 429 })
  }

  const body = await req.json()
  const { variant, color, text, world_x, world_y, rotation, z_index } = body

  if (!variant || !color || typeof text !== 'string') {
    return NextResponse.json({ error: 'Invalid note data' }, { status: 400 })
  }
  if (text.length > 24) {
    return NextResponse.json({ error: 'Text too long' }, { status: 400 })
  }
  const validColors = ['yellow', 'blue', 'red']
  if (!validColors.includes(color)) {
    return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
  }

  const noteData = {
    variant: String(variant).slice(0, 50),
    color: String(color),
    text: String(text).slice(0, 24),
    world_x: Math.round(Number(world_x)) || 0,
    world_y: Math.round(Number(world_y)) || 0,
    rotation: Number(rotation) || 0,
    z_index: Number(z_index) || 1,
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
