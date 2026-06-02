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

async function buildQuestion(
  session: { id: number; current_team: string },
  contestantId: number,
  questionId: number,
  multiplier: number,
  helplines_used: string[]
) {
  const contestant = db.prepare('SELECT id, name, team FROM contestants WHERE id = ?').get(contestantId) as {
    id: number; name: string; team: string
  }
  const question = db.prepare('SELECT id, text FROM questions WHERE id = ?').get(questionId) as {
    id: number; text: string
  }
  const correctRow = db.prepare(
    'SELECT answer FROM answers WHERE contestant_id = ? AND question_id = ?'
  ).get(contestantId, questionId) as { answer: string } | undefined

  if (!correctRow) return null

  const correctAnswer = correctRow.answer

  const otherAnswers = db.prepare(`
    SELECT DISTINCT answer FROM answers
    WHERE question_id = ? AND contestant_id != ? AND answer != ?
    LIMIT 8
  `).all(questionId, contestantId, correctAnswer) as Array<{ answer: string }>

  const wrongAnswerTexts = otherAnswers.map(r => r.answer)
  let padIndex = 0
  while (wrongAnswerTexts.length < 4) {
    const fallback = FALLBACK_WRONG[padIndex % FALLBACK_WRONG.length]
    if (!wrongAnswerTexts.includes(fallback) && fallback !== correctAnswer) {
      wrongAnswerTexts.push(fallback)
    }
    padIndex++
    if (padIndex > 20) break
  }

  const finalWrong = wrongAnswerTexts.slice(0, 4)
  const allOptions = shuffle([
    { text: correctAnswer, is_correct: true },
    ...finalWrong.map(t => ({ text: t, is_correct: false })),
  ])
  const options = allOptions.map((opt, i) => ({
    id: OPTION_LABELS[i],
    text: opt.text,
    is_correct: opt.is_correct,
  }))

  return { contestant, question, options, multiplier, helplines_used }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type } = body

    if (!['same_person', 'opposing_team', 'wild', 'remove_two'].includes(type)) {
      return NextResponse.json({ error: 'Invalid helpline type' }, { status: 400 })
    }

    const session = db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1').get() as {
      id: number
      status: string
      current_team: string
      team_a_score: number
      team_b_score: number
      team_a_removes_used: number
      team_b_removes_used: number
      current_state: string
    } | undefined

    if (!session || session.status !== 'questioning') {
      return NextResponse.json({ error: 'Not in questioning state' }, { status: 400 })
    }

    const currentState = JSON.parse(session.current_state || '{}')
    const helplines_used: string[] = currentState.helplines_used || []

    if (helplines_used.includes(type) && type !== 'remove_two') {
      return NextResponse.json({ error: 'Helpline already used' }, { status: 400 })
    }

    const isTeamA = session.current_team === 'A'
    const removesUsed = isTeamA ? session.team_a_removes_used : session.team_b_removes_used

    if (type === 'remove_two' && removesUsed >= 2) {
      return NextResponse.json({ error: 'Remove two helpline used maximum times' }, { status: 400 })
    }

    let costPoints = 0
    let multiplierReduction = 0
    let newState = { ...currentState }

    if (type === 'remove_two') {
      // Remove 2 wrong options
      costPoints = 50
      multiplierReduction = 0.25

      const eliminated: string[] = currentState.eliminated_options || []
      const wrongOptions = currentState.options.filter(
        (o: { id: string; is_correct: boolean }) => !o.is_correct && !eliminated.includes(o.id)
      )

      if (wrongOptions.length < 2) {
        return NextResponse.json({ error: 'Not enough wrong options to remove' }, { status: 400 })
      }

      const toRemove = shuffle(wrongOptions).slice(0, 2).map((o) => (o as { id: string }).id)
      const newEliminated = [...eliminated, ...toRemove]

      newState.eliminated_options = newEliminated
      newState.reward_multiplier = Math.max(0.25, (currentState.reward_multiplier ?? 1.0) - multiplierReduction)
      newState.helplines_used = [...helplines_used, type]

      // Update removes used
      if (isTeamA) {
        db.prepare('UPDATE game_sessions SET team_a_removes_used = team_a_removes_used + 1 WHERE id = ?').run(session.id)
      } else {
        db.prepare('UPDATE game_sessions SET team_b_removes_used = team_b_removes_used + 1 WHERE id = ?').run(session.id)
      }

      // Deduct cost
      if (isTeamA) {
        db.prepare('UPDATE game_sessions SET team_a_score = team_a_score - ? WHERE id = ?').run(costPoints, session.id)
      } else {
        db.prepare('UPDATE game_sessions SET team_b_score = team_b_score - ? WHERE id = ?').run(costPoints, session.id)
      }

      db.prepare('UPDATE game_sessions SET current_state = ? WHERE id = ?').run(JSON.stringify(newState), session.id)

      return NextResponse.json({
        success: true,
        eliminated_options: newEliminated,
        options: newState.options,
        reward_multiplier: newState.reward_multiplier,
      })
    }

    // For question-changing helplines
    let targetContestantId: number
    let newQuestionId: number | null = null

    if (type === 'same_person') {
      costPoints = 100
      multiplierReduction = 0.5
      targetContestantId = currentState.contestant_id

      // Get unused questions for same contestant
      const usedRows = db.prepare(`
        SELECT question_id FROM used_questions WHERE session_id = ? AND contestant_id = ?
      `).all(session.id, targetContestantId) as Array<{ question_id: number }>
      const usedIds = new Set(usedRows.map(r => r.question_id))
      usedIds.add(currentState.question_id)

      const answeredQuestions = db.prepare(`
        SELECT q.id FROM questions q
        JOIN answers a ON a.question_id = q.id
        WHERE a.contestant_id = ?
      `).all(targetContestantId) as Array<{ id: number }>

      const available = answeredQuestions.filter(q => !usedIds.has(q.id))
      if (available.length === 0) {
        return NextResponse.json({ error: 'No more questions available for this contestant' }, { status: 400 })
      }
      newQuestionId = available[Math.floor(Math.random() * available.length)].id

    } else if (type === 'opposing_team') {
      costPoints = 75
      multiplierReduction = 0.5
      const opposingTeam = session.current_team === 'A' ? 'B' : 'A'

      const opposingContestants = db.prepare(
        'SELECT id FROM contestants WHERE team = ?'
      ).all(opposingTeam) as Array<{ id: number }>

      if (opposingContestants.length === 0) {
        return NextResponse.json({ error: 'No contestants in opposing team' }, { status: 400 })
      }

      // Pick random contestant from opposing team that has answered questions
      const shuffled = shuffle(opposingContestants)
      let found = false

      for (const c of shuffled) {
        const answeredQuestions = db.prepare(`
          SELECT q.id FROM questions q
          JOIN answers a ON a.question_id = q.id
          WHERE a.contestant_id = ?
        `).all(c.id) as Array<{ id: number }>

        if (answeredQuestions.length > 0) {
          targetContestantId = c.id
          const q = answeredQuestions[Math.floor(Math.random() * answeredQuestions.length)]
          newQuestionId = q.id
          found = true
          break
        }
      }

      if (!found) {
        return NextResponse.json({ error: 'No answers available from opposing team' }, { status: 400 })
      }

    } else if (type === 'wild') {
      costPoints = 200
      multiplierReduction = 0.5

      const wildContestants = db.prepare(
        'SELECT id FROM contestants WHERE team = ?'
      ).all('WILD') as Array<{ id: number }>

      if (wildContestants.length === 0) {
        return NextResponse.json({ error: 'No wild contestants available' }, { status: 400 })
      }

      const shuffled = shuffle(wildContestants)
      let found = false

      for (const c of shuffled) {
        const answeredQuestions = db.prepare(`
          SELECT q.id FROM questions q
          JOIN answers a ON a.question_id = q.id
          WHERE a.contestant_id = ?
        `).all(c.id) as Array<{ id: number }>

        if (answeredQuestions.length > 0) {
          targetContestantId = c.id
          const q = answeredQuestions[Math.floor(Math.random() * answeredQuestions.length)]
          newQuestionId = q.id
          found = true
          break
        }
      }

      if (!found) {
        return NextResponse.json({ error: 'No answers available from wild contestants' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Deduct cost
    if (isTeamA) {
      db.prepare('UPDATE game_sessions SET team_a_score = team_a_score - ? WHERE id = ?').run(costPoints, session.id)
    } else {
      db.prepare('UPDATE game_sessions SET team_b_score = team_b_score - ? WHERE id = ?').run(costPoints, session.id)
    }

    const newMultiplier = Math.max(0.25, (currentState.reward_multiplier ?? 1.0) - multiplierReduction)
    const newHelplines = [...helplines_used, type]

    // Build new question
    const result = await buildQuestion(
      session,
      targetContestantId!,
      newQuestionId!,
      newMultiplier,
      newHelplines
    )

    if (!result) {
      return NextResponse.json({ error: 'Failed to build question' }, { status: 500 })
    }

    // Mark new question as used
    try {
      db.prepare(`
        INSERT OR IGNORE INTO used_questions (session_id, contestant_id, question_id)
        VALUES (?, ?, ?)
      `).run(session.id, targetContestantId!, newQuestionId!)
    } catch { /* ignore */ }

    // Update state
    newState = {
      contestant_id: targetContestantId!,
      contestant_name: result.contestant.name,
      question_id: newQuestionId!,
      question_text: result.question.text,
      wager: currentState.wager,
      reward_multiplier: newMultiplier,
      options: result.options,
      eliminated_options: [],
      helplines_used: newHelplines,
      selected_option: null,
      last_result: null,
    }

    db.prepare(`
      UPDATE game_sessions SET current_state = ?, last_question_id = ? WHERE id = ?
    `).run(JSON.stringify(newState), newQuestionId!, session.id)

    return NextResponse.json({
      success: true,
      question_text: result.question.text,
      contestant_name: result.contestant.name,
      contestant_id: targetContestantId!,
      question_id: newQuestionId!,
      options: result.options,
      reward_multiplier: newMultiplier,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
