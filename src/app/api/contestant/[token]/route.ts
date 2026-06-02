import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const contestant = db.prepare('SELECT id, name, team FROM contestants WHERE token = ?').get(params.token)
    if (!contestant) {
      return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
    }

    const c = contestant as { id: number; name: string; team: string }

    const questions = db.prepare('SELECT id, text FROM questions ORDER BY id ASC').all()
    const answers = db.prepare(`
      SELECT question_id, answer, id as answer_id
      FROM answers
      WHERE contestant_id = ?
    `).all(c.id)

    const answerMap = new Map<number, { answer: string; answer_id: number }>()
    for (const a of answers as Array<{ question_id: number; answer: string; answer_id: number }>) {
      answerMap.set(a.question_id, { answer: a.answer, answer_id: a.answer_id })
    }

    const questionsWithAnswers = (questions as Array<{ id: number; text: string }>).map(q => ({
      ...q,
      existing_answer: answerMap.get(q.id)?.answer || null,
      answer_id: answerMap.get(q.id)?.answer_id || null,
    }))

    return NextResponse.json({
      contestant: c,
      questions: questionsWithAnswers,
    })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const contestant = db.prepare('SELECT id, name, team FROM contestants WHERE token = ?').get(params.token)
    if (!contestant) {
      return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
    }

    const c = contestant as { id: number; name: string; team: string }
    const body = await request.json()
    const { answers } = body

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: 'answers must be an array' }, { status: 400 })
    }

    const upsert = db.prepare(`
      INSERT INTO answers (contestant_id, question_id, answer)
      VALUES (?, ?, ?)
      ON CONFLICT(contestant_id, question_id) DO UPDATE SET answer = excluded.answer
    `)

    const saveAll = db.transaction((items: Array<{ question_id: number; answer: string }>) => {
      for (const item of items) {
        if (item.question_id && item.answer && item.answer.trim()) {
          upsert.run(c.id, item.question_id, item.answer.trim())
        }
      }
    })

    saveAll(answers)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
