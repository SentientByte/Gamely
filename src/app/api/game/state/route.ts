import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
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

    return NextResponse.json({
      session: {
        ...s,
        current_state: currentState,
      }
    })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
