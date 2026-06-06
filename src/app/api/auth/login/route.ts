import { NextRequest, NextResponse } from 'next/server'
import { validateCredentials, ADMIN_TOKEN_VALUE, ADMIN_COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    if (!validateCredentials(username, password)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(ADMIN_COOKIE_NAME, ADMIN_TOKEN_VALUE, {
      httpOnly: true,
      secure: process.env.SECURE_COOKIES !== 'false' && process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
