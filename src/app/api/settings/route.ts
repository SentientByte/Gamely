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

    const helplineKeys = ['helpline_remove_two', 'helpline_same_person', 'helpline_opposing_team']
    const pctKeys = [
      'steal_correct_opponent_loss_pct',
      'steal_wrong_self_pct',
      'steal_wrong_opponent_pct',
      'wild_correct_bonus_pct',
      'wild_wrong_opponent_pct',
    ]
    const intKeys = [
      'timer_duration',
      'steal_max_wager',
      'wild_max_wager',
      'default_start_score',
    ]
    db.transaction(() => {
      for (const key of helplineKeys) {
        if (body[key] !== undefined) {
          const val = body[key]
          if (typeof val.cost !== 'number' || typeof val.multiplier_reduction !== 'number') continue
          upsert.run(key, JSON.stringify({ cost: val.cost, multiplier_reduction: val.multiplier_reduction }))
        }
      }
      for (const key of pctKeys) {
        if (body[key] !== undefined && typeof body[key] === 'number' && body[key] >= 0) {
          upsert.run(key, JSON.stringify(body[key]))
        }
      }
      for (const key of intKeys) {
        if (body[key] !== undefined && typeof body[key] === 'number' && body[key] >= 0) {
          upsert.run(key, JSON.stringify(body[key]))
        }
      }
    })()

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
