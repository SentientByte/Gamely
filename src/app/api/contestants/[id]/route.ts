import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

function checkAuth(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  return isValidAdminToken(token)
}

export async function GET(
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

  const contestant = db.prepare('SELECT * FROM contestants WHERE id = ?').get(id)
  if (!contestant) {
    return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
  }

  const answers = db.prepare(`
    SELECT a.*, q.text as question_text
    FROM answers a
    JOIN questions q ON a.question_id = q.id
    WHERE a.contestant_id = ?
    ORDER BY q.id ASC
  `).all(id)

  return NextResponse.json({ ...contestant as object, answers })
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
    const { name, team } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Contestant name is required' }, { status: 400 })
    }

    if (!team || !['A', 'B', 'WILD'].includes(team)) {
      return NextResponse.json({ error: 'Team must be A, B, or WILD' }, { status: 400 })
    }

    const result = db.prepare(
      'UPDATE contestants SET name = ?, team = ? WHERE id = ?'
    ).run(name.trim(), team, id)

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
    }

    const contestant = db.prepare('SELECT * FROM contestants WHERE id = ?').get(id)
    return NextResponse.json(contestant)
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

  const result = db.prepare('DELETE FROM contestants WHERE id = ?').run(id)
  if (result.changes === 0) {
    return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
