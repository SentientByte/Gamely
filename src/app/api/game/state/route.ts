import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const session = db.prepare(`
      SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1
    `).get()

    if (!session) {
      return NextResponse.json({ session: null })
    }

    const s = session as {
      id: number
      status: string
      current_team: string
      team_a_score: number
      team_b_score: number
      team_a_removes_used: number
      team_b_removes_used: number
      current_state: string
      last_question_id: number | null
    }

    const currentState = JSON.parse(s.current_state || '{}')
    const wildCount = (db.prepare('SELECT COUNT(*) as cnt FROM wild_questions').get() as { cnt: number }).cnt

    return NextResponse.json({
      session: {
        ...s,
        current_state: currentState,
      },
      wild_questions_count: wildCount,
    })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
