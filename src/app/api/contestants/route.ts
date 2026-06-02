import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
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
    const contestants = db.prepare('SELECT * FROM contestants ORDER BY team, id ASC').all()
    return NextResponse.json(contestants)
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
    const { name, team } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Contestant name is required' }, { status: 400 })
    }

    if (!team || !['A', 'B', 'WILD'].includes(team)) {
      return NextResponse.json({ error: 'Team must be A, B, or WILD' }, { status: 400 })
    }

    const token = randomUUID()
    const result = db.prepare(
      'INSERT INTO contestants (name, team, token) VALUES (?, ?, ?)'
    ).run(name.trim(), team, token)

    const contestant = db.prepare('SELECT * FROM contestants WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(contestant, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
