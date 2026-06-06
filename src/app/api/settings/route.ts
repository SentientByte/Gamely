import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
  const settings: Record<string, unknown> = {}
  for (const row of rows) {
    settings[row.key] = JSON.parse(row.value)
  }
  return NextResponse.json(settings)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')

    const helplineKeys = ['helpline_remove_two', 'helpline_same_person', 'helpline_opposing_team', 'helpline_wild']
    db.transaction(() => {
      for (const key of helplineKeys) {
        if (body[key] !== undefined) {
          const val = body[key]
          if (typeof val.cost !== 'number' || typeof val.multiplier_reduction !== 'number') continue
          upsert.run(key, JSON.stringify({ cost: val.cost, multiplier_reduction: val.multiplier_reduction }))
        }
      }
      if (body.timer_duration !== undefined && typeof body.timer_duration === 'number' && body.timer_duration >= 10) {
        upsert.run('timer_duration', JSON.stringify(body.timer_duration))
      }
    })()

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
