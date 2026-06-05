import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const contestantId = url.searchParams.get('contestant_id')
  const rows = contestantId
    ? db.prepare('SELECT * FROM custom_player_questions WHERE contestant_id = ? ORDER BY id ASC').all(parseInt(contestantId))
    : db.prepare('SELECT cpq.*, c.name as contestant_name FROM custom_player_questions cpq JOIN contestants c ON c.id = cpq.contestant_id ORDER BY cpq.id ASC').all()
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { contestant_id, question_text, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3, wrong_answer_4, min_wager, max_wager } = body
    if (!contestant_id || !question_text || !correct_answer || !wrong_answer_1 || !wrong_answer_2 || !wrong_answer_3 || !wrong_answer_4) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }
    const result = db.prepare(`
      INSERT INTO custom_player_questions (contestant_id, question_text, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3, wrong_answer_4, min_wager, max_wager)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contestant_id, question_text, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3, wrong_answer_4, min_wager ?? 0, max_wager ?? 1000)
    return NextResponse.json({ id: result.lastInsertRowid })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
