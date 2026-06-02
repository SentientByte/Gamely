import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

function checkAuth(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  return isValidAdminToken(token)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { answer } = body

    if (!answer || typeof answer !== 'string' || answer.trim() === '') {
      return NextResponse.json({ error: 'Answer text is required' }, { status: 400 })
    }

    const result = db.prepare('UPDATE answers SET answer = ? WHERE id = ?').run(answer.trim(), id)
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Answer not found' }, { status: 404 })
    }

    const updated = db.prepare(`
      SELECT a.*, q.text as question_text, c.name as contestant_name
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      JOIN contestants c ON a.contestant_id = c.id
      WHERE a.id = ?
    `).get(id)

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const result = db.prepare('DELETE FROM answers WHERE id = ?').run(id)
  if (result.changes === 0) {
    return NextResponse.json({ error: 'Answer not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
