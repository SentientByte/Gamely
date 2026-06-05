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
    const questions = db.prepare('SELECT * FROM questions ORDER BY id ASC').all()
    return NextResponse.json(questions)
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
    const { text } = body

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 })
    }

    const { personalized_template } = body
    const result = db.prepare('INSERT INTO questions (text, personalized_template) VALUES (?, ?)').run(text.trim(), personalized_template?.trim() || null)
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid)

    return NextResponse.json(question, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
