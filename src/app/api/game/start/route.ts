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
    const teamAScore = body.team_a_score ?? 0
    const teamBScore = body.team_b_score ?? 0
    const teamAIds: number[] = body.team_a_ids ?? []
    const teamBIds: number[] = body.team_b_ids ?? []

    // Update team assignments for non-WILD contestants
    const assignTeam = db.prepare(`UPDATE contestants SET team = ? WHERE id = ? AND team != 'WILD'`)
    const resetUnassigned = db.prepare(`UPDATE contestants SET team = 'UNASSIGNED' WHERE team IN ('A','B')`)

    db.transaction(() => {
      resetUnassigned.run()
      for (const id of teamAIds) assignTeam.run('A', id)
      for (const id of teamBIds) assignTeam.run('B', id)
    })()

    // Randomly decide starting team
    const startingTeam = Math.random() < 0.5 ? 'A' : 'B'

    // Delete any existing sessions
    db.prepare('DELETE FROM game_sessions').run()

    const result = db.prepare(`
      INSERT INTO game_sessions (status, current_team, team_a_score, team_b_score, current_state, wager_usage, steal_used_a, steal_used_b, used_question_topics)
      VALUES ('wagering', ?, ?, ?, '{}', '{}', 0, 0, '[]')
    `).run(startingTeam, teamAScore, teamBScore)

    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(result.lastInsertRowid)
    const s = session as { current_state: string; [key: string]: unknown }

    return NextResponse.json({
      session: {
        ...s,
        current_state: JSON.parse(s.current_state || '{}'),
      },
      starting_team: startingTeam,
    })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
