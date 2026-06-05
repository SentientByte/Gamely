import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  db.prepare('DELETE FROM custom_player_questions WHERE id = ?').run(parseInt(id))
  return NextResponse.json({ success: true })
}
