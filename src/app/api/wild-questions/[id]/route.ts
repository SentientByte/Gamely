import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { question_text, correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3, wrong_answer_4 } = body

    if (!question_text?.trim() || !correct_answer?.trim() || !wrong_answer_1?.trim() || !wrong_answer_2?.trim() || !wrong_answer_3?.trim() || !wrong_answer_4?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    db.prepare(`
      UPDATE wild_questions SET question_text=?, correct_answer=?, wrong_answer_1=?, wrong_answer_2=?, wrong_answer_3=?, wrong_answer_4=?
      WHERE id=?
    `).run(question_text.trim(), correct_answer.trim(), wrong_answer_1.trim(), wrong_answer_2.trim(), wrong_answer_3.trim(), wrong_answer_4.trim(), parseInt(id))

    const q = db.prepare('SELECT * FROM wild_questions WHERE id = ?').get(parseInt(id))
    return NextResponse.json(q)
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    db.prepare('DELETE FROM wild_questions WHERE id = ?').run(parseInt(id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
