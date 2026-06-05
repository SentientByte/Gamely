import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const questions = db.prepare('SELECT * FROM wild_questions ORDER BY created_at DESC').all()
  return NextResponse.json(questions)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { question_text, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3, wrong_answer_4 } = body

    if (!question_text?.trim() || !correct_answer?.trim() || !wrong_answer_1?.trim() || !wrong_answer_2?.trim() || !wrong_answer_3?.trim() || !wrong_answer_4?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO wild_questions (question_text, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3, wrong_answer_4)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(question_text.trim(), correct_answer.trim(), wrong_answer_1.trim(), wrong_answer_2.trim(), wrong_answer_3.trim(), wrong_answer_4.trim())

    const q = db.prepare('SELECT * FROM wild_questions WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(q, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
