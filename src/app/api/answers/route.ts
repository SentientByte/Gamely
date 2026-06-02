import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

function checkAuth(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  return isValidAdminToken(token)
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const contestantId = searchParams.get('contestant_id')

    let answers
    if (contestantId) {
      const id = parseInt(contestantId)
      if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid contestant_id' }, { status: 400 })
      }
      answers = db.prepare(`
        SELECT a.*, q.text as question_text, c.name as contestant_name
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        JOIN contestants c ON a.contestant_id = c.id
        WHERE a.contestant_id = ?
        ORDER BY q.id ASC
      `).all(id)
    } else {
      answers = db.prepare(`
        SELECT a.*, q.text as question_text, c.name as contestant_name
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        JOIN contestants c ON a.contestant_id = c.id
        ORDER BY c.team, c.id, q.id ASC
      `).all()
    }

    return NextResponse.json(answers)
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { contestant_id, question_id, answer } = body

    if (!contestant_id || !question_id || !answer) {
      return NextResponse.json({ error: 'contestant_id, question_id, and answer are required' }, { status: 400 })
    }

    // Check contestant exists
    const contestant = db.prepare('SELECT id FROM contestants WHERE id = ?').get(contestant_id)
    if (!contestant) {
      return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
    }

    // Check question exists
    const question = db.prepare('SELECT id FROM questions WHERE id = ?').get(question_id)
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Upsert answer
    db.prepare(`
      INSERT INTO answers (contestant_id, question_id, answer)
      VALUES (?, ?, ?)
      ON CONFLICT(contestant_id, question_id) DO UPDATE SET answer = excluded.answer
    `).run(contestant_id, question_id, answer.trim())

    const saved = db.prepare(`
      SELECT a.*, q.text as question_text, c.name as contestant_name
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      JOIN contestants c ON a.contestant_id = c.id
      WHERE a.contestant_id = ? AND a.question_id = ?
    `).get(contestant_id, question_id)

    return NextResponse.json(saved, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
