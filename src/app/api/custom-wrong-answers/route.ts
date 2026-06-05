import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const contestantId = url.searchParams.get('contestant_id')
  const questionId = url.searchParams.get('question_id')

  let rows
  if (contestantId && questionId) {
    rows = db.prepare('SELECT * FROM custom_wrong_answers WHERE contestant_id = ? AND question_id = ? ORDER BY id ASC').all(parseInt(contestantId), parseInt(questionId))
  } else if (contestantId) {
    rows = db.prepare('SELECT * FROM custom_wrong_answers WHERE contestant_id = ? ORDER BY id ASC').all(parseInt(contestantId))
  } else {
    rows = db.prepare('SELECT cwa.*, c.name as contestant_name, q.text as question_text FROM custom_wrong_answers cwa JOIN contestants c ON c.id = cwa.contestant_id JOIN questions q ON q.id = cwa.question_id ORDER BY cwa.id ASC').all()
  }
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { contestant_id, question_id, wrong_answer } = body
    if (!contestant_id || !question_id || !wrong_answer) {
      return NextResponse.json({ error: 'contestant_id, question_id, and wrong_answer are required' }, { status: 400 })
    }
    const result = db.prepare('INSERT OR IGNORE INTO custom_wrong_answers (contestant_id, question_id, wrong_answer) VALUES (?, ?, ?)').run(contestant_id, question_id, wrong_answer)
    return NextResponse.json({ id: result.lastInsertRowid })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
