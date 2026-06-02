import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { isValidAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const OPTION_LABELS = ['أ', 'ب', 'ج', 'د', 'هـ']
const FALLBACK_WRONG = ['لا أعرف', 'ربما', 'لم أقرر بعد', 'سؤال صعب', 'لا شيء من هذا']

const MONTH_NAMES_AR = {
  '01': 'يناير',
  '02': 'فبراير',
  '03': 'مارس',
  '04': 'أبريل',
  '05': 'مايو',
  '06': 'يونيو',
  '07': 'يوليو',
  '08': 'أغسطس',
  '09': 'سبتمبر',
  '10': 'أكتوبر',
  '11': 'نوفمبر',
  '12': 'ديسمبر',
}

function formatBirthdayWithMonthName(answer: string): string {
  const parts = answer.split('/')
  if (parts.length === 2) {
    const monthNum = parts[0]
    const day = parts[1]
    const monthName = MONTH_NAMES_AR[monthNum as keyof typeof MONTH_NAMES_AR]
    if (monthName) {
      return `${monthName}/${day}`
    }
  }
  return answer
}

const QUESTION_TEMPLATES = {
  1: (answer: string) => `من وُلد في ${formatBirthdayWithMonthName(answer)}؟`,
  2: (answer: string) => `من لونه المفضل هو ${answer}؟`,
  3: (answer: string) => `من معدله في الثانوية العامة ${answer}؟`,
  4: (answer: string) => `من أفضل أصدقاؤه ${answer}؟`,
  5: (answer: string) => `من وجبته المفضلة هي ${answer}؟`,
  6: (answer: string) => `من يتمنى زيارة ${answer}؟`,
  7: (answer: string) => `من آيته المفضلة هي ${answer}؟`,
  8: (answer: string) => `من سورته المفضلة هي ${answer}؟`,
  9: (answer: string) => `من مقاس حذائه ${answer}؟`,
  10: (answer: string) => `من يريد أن يفعل أولاً: ${answer}؟`,
}

function buildReverseQuestion(
  questionId: number,
  correctAnswer: string
): string {
  const template = QUESTION_TEMPLATES[questionId as keyof typeof QUESTION_TEMPLATES]
  if (!template) {
    return `من الإجابة الصحيحة هي ${correctAnswer}؟`
  }
  return template(correctAnswer)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { contestant_id, question_id } = body

    if (!contestant_id) {
      return NextResponse.json({ error: 'contestant_id is required' }, { status: 400 })
    }

    const session = db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1').get() as {
      id: number
      status: string
      current_team: string
      current_state: string
      last_question_id: number | null
      [key: string]: unknown
    } | undefined

    if (!session) {
      return NextResponse.json({ error: 'No active game session' }, { status: 400 })
    }

    // Verify contestant exists and belongs to the current team
    const contestant = db.prepare('SELECT * FROM contestants WHERE id = ?').get(contestant_id) as {
      id: number
      name: string
      team: string
    } | undefined

    if (!contestant) {
      return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
    }

    // Get already used question IDs for this contestant in this session
    const usedRows = db.prepare(`
      SELECT question_id FROM used_questions
      WHERE session_id = ? AND contestant_id = ?
    `).all(session.id, contestant_id) as Array<{ question_id: number }>
    const usedQuestionIds = new Set(usedRows.map(r => r.question_id))

    let selectedQuestion: { id: number; text: string } | undefined

    if (question_id) {
      selectedQuestion = db.prepare('SELECT id, text FROM questions WHERE id = ?').get(question_id) as typeof selectedQuestion
      if (!selectedQuestion) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      }
    } else {
      // Pick random unused question for this contestant (avoid last question if possible)
      const allQuestions = db.prepare('SELECT id, text FROM questions ORDER BY id ASC').all() as Array<{ id: number; text: string }>
      const available = allQuestions.filter(q => !usedQuestionIds.has(q.id))

      if (available.length === 0) {
        return NextResponse.json({ error: 'No more questions available for this contestant' }, { status: 400 })
      }

      // Prefer not to repeat last question
      const preferred = available.filter(q => q.id !== session.last_question_id)
      const pool = preferred.length > 0 ? preferred : available
      selectedQuestion = pool[Math.floor(Math.random() * pool.length)]
    }

    // Get correct answer
    const correctAnswerRow = db.prepare(`
      SELECT answer FROM answers WHERE contestant_id = ? AND question_id = ?
    `).get(contestant_id, selectedQuestion.id) as { answer: string } | undefined

    if (!correctAnswerRow) {
      return NextResponse.json({ error: 'This contestant has not answered this question' }, { status: 400 })
    }

    const correctAnswer = correctAnswerRow.answer

    // Get current state for wager/multiplier
    const currentState = JSON.parse(session.current_state || '{}')
    const wager = currentState.wager || 100
    const rewardMultiplier = currentState.reward_multiplier ?? 1.0
    const helplines_used = currentState.helplines_used || []

    let questionText = selectedQuestion.text
    let options: Array<{ id: string; text: string; is_correct: boolean }>
    let isReverseQuestion = false

    // For high wagers (>499), use reverse question format
    if (wager > 499) {
      isReverseQuestion = true
      questionText = buildReverseQuestion(selectedQuestion.id, correctAnswer)

      // Get all contestants with their names
      const allContestants = db.prepare('SELECT id, name FROM contestants ORDER BY id ASC').all() as Array<{ id: number; name: string }>

      if (allContestants.length < 2) {
        return NextResponse.json({ error: 'Not enough contestants for reverse question' }, { status: 400 })
      }

      // The correct answer is the name of the contestant we're asking about
      const correctContestantName = contestant.name

      // Get other contestant names (wrong answers)
      const wrongNames = allContestants
        .filter(c => c.id !== contestant_id)
        .map(c => c.name)
        .slice(0, 4)

      // Build options array with contestant names and shuffle
      const allOptions = shuffle([
        { text: correctContestantName, is_correct: true },
        ...wrongNames.map(t => ({ text: t, is_correct: false })),
      ])

      options = allOptions.map((opt, i) => ({
        id: OPTION_LABELS[i],
        text: opt.text,
        is_correct: opt.is_correct,
      }))
    } else {
      // Normal question format: get wrong answers from other contestants
      const otherAnswers = db.prepare(`
        SELECT DISTINCT answer FROM answers
        WHERE question_id = ? AND contestant_id != ? AND answer != ?
        LIMIT 8
      `).all(selectedQuestion.id, contestant_id, correctAnswer) as Array<{ answer: string }>

      const wrongAnswerTexts = otherAnswers.map(r => r.answer)

      // Pad with fallbacks if needed
      let padIndex = 0
      while (wrongAnswerTexts.length < 4) {
        const fallback = FALLBACK_WRONG[padIndex % FALLBACK_WRONG.length]
        if (!wrongAnswerTexts.includes(fallback) && fallback !== correctAnswer) {
          wrongAnswerTexts.push(fallback)
        }
        padIndex++
        if (padIndex > 20) break
      }

      // Take exactly 4 wrong answers
      const finalWrong = wrongAnswerTexts.slice(0, 4)

      // Build options array and shuffle
      const allOptions = shuffle([
        { text: correctAnswer, is_correct: true },
        ...finalWrong.map(t => ({ text: t, is_correct: false })),
      ])

      options = allOptions.map((opt, i) => ({
        id: OPTION_LABELS[i],
        text: opt.text,
        is_correct: opt.is_correct,
      }))
    }

    // Mark question as used
    try {
      db.prepare(`
        INSERT OR IGNORE INTO used_questions (session_id, contestant_id, question_id)
        VALUES (?, ?, ?)
      `).run(session.id, contestant_id, selectedQuestion.id)
    } catch {
      // ignore duplicate
    }

    // Update session state
    const newState = {
      contestant_id,
      contestant_name: contestant.name,
      question_id: selectedQuestion.id,
      question_text: questionText,
      wager,
      reward_multiplier: rewardMultiplier,
      options,
      eliminated_options: [],
      helplines_used,
      selected_option: null,
      last_result: null,
      is_reverse_question: isReverseQuestion,
      original_answer: isReverseQuestion ? correctAnswer : undefined,
    }

    db.prepare(`
      UPDATE game_sessions
      SET status = 'questioning', current_state = ?, last_question_id = ?
      WHERE id = ?
    `).run(JSON.stringify(newState), selectedQuestion.id, session.id)

    return NextResponse.json({
      question_text: questionText,
      options,
      contestant_name: contestant.name,
      contestant_id: contestant.id,
      question_id: selectedQuestion.id,
      wager,
      reward_multiplier: rewardMultiplier,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
