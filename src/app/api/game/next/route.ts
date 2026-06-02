import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const session = db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1').get() as {
      id: number
      status: string
      current_team: string
      team_a_score: number
      team_b_score: number
    } | undefined

    if (!session) {
      return NextResponse.json({ error: 'No active game session' }, { status: 400 })
    }

    if (session.status !== 'result') {
      return NextResponse.json({ error: 'Not in result state' }, { status: 400 })
    }

    // Switch team
    const nextTeam = session.current_team === 'A' ? 'B' : 'A'

    db.prepare(`
      UPDATE game_sessions
      SET status = 'wagering', current_team = ?, current_state = '{}'
      WHERE id = ?
    `).run(nextTeam, session.id)

    return NextResponse.json({ success: true, current_team: nextTeam })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
