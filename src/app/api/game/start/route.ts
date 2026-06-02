import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const teamAScore = body.team_a_score ?? 1000
    const teamBScore = body.team_b_score ?? 1000

    // Delete any existing sessions
    db.prepare('DELETE FROM game_sessions').run()

    const result = db.prepare(`
      INSERT INTO game_sessions (status, current_team, team_a_score, team_b_score, current_state)
      VALUES ('wagering', 'A', ?, ?, '{}')
    `).run(teamAScore, teamBScore)

    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(result.lastInsertRowid)
    const s = session as { current_state: string; [key: string]: unknown }

    return NextResponse.json({
      session: {
        ...s,
        current_state: JSON.parse(s.current_state || '{}'),
      }
    })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
