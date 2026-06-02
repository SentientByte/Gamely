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
    const { amount } = body

    if (!amount || typeof amount !== 'number' || amount < 100 || amount > 1000 || amount % 100 !== 0) {
      return NextResponse.json({ error: 'Amount must be 100-1000 in multiples of 100' }, { status: 400 })
    }

    const session = db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1').get() as {
      id: number
      status: string
      current_state: string
      [key: string]: unknown
    } | undefined

    if (!session) {
      return NextResponse.json({ error: 'No active game session' }, { status: 400 })
    }

    if (session.status !== 'wagering') {
      return NextResponse.json({ error: 'Not in wagering state' }, { status: 400 })
    }

    const currentState = JSON.parse(session.current_state || '{}')
    currentState.wager = amount

    db.prepare(`
      UPDATE game_sessions SET current_state = ? WHERE id = ?
    `).run(JSON.stringify(currentState), session.id)

    return NextResponse.json({ success: true, wager: amount })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
