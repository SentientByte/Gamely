import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const session = db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined
    if (!session) return NextResponse.json({ error: 'No active session' }, { status: 400 })

    db.prepare("UPDATE game_sessions SET status = 'finished', current_state = '{}' WHERE id = ?").run(session.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
