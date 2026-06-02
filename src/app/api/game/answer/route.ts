import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { option_id } = body

    if (!option_id) {
      return NextResponse.json({ error: 'option_id is required' }, { status: 400 })
    }

    const session = db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1').get() as {
      id: number
      status: string
      current_team: string
      team_a_score: number
      team_b_score: number
      current_state: string
    } | undefined

    if (!session || session.status !== 'questioning') {
      return NextResponse.json({ error: 'Not in questioning state' }, { status: 400 })
    }

    const currentState = JSON.parse(session.current_state || '{}')
    const options: Array<{ id: string; text: string; is_correct: boolean }> = currentState.options || []
    const wager: number = currentState.wager || 100
    const multiplier: number = currentState.reward_multiplier ?? 1.0

    const selectedOption = options.find(o => o.id === option_id)
    if (!selectedOption) {
      return NextResponse.json({ error: 'Invalid option_id' }, { status: 400 })
    }

    const correctOption = options.find(o => o.is_correct)
    const isCorrect = selectedOption.is_correct

    let scoreChange: number
    if (isCorrect) {
      scoreChange = Math.round(wager * multiplier)
    } else {
      scoreChange = -Math.round(wager * 0.5)
    }

    const isTeamA = session.current_team === 'A'

    if (isTeamA) {
      db.prepare('UPDATE game_sessions SET team_a_score = team_a_score + ? WHERE id = ?').run(scoreChange, session.id)
    } else {
      db.prepare('UPDATE game_sessions SET team_b_score = team_b_score + ? WHERE id = ?').run(scoreChange, session.id)
    }

    currentState.selected_option = option_id
    currentState.last_result = {
      correct: isCorrect,
      score_change: scoreChange,
      correct_answer: correctOption?.text || '',
      correct_option_id: correctOption?.id || '',
    }

    db.prepare(`
      UPDATE game_sessions SET status = 'result', current_state = ? WHERE id = ?
    `).run(JSON.stringify(currentState), session.id)

    return NextResponse.json({
      correct: isCorrect,
      correct_answer: correctOption?.text || '',
      correct_option_id: correctOption?.id || '',
      score_change: scoreChange,
      wager,
      multiplier,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
