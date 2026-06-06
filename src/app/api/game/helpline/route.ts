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
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
}

function formatBirthdayWithMonthName(answer: string): string {
  const parts = answer.split('/')
  if (parts.length === 2) {
    const monthName = MONTH_NAMES_AR[parts[0] as keyof typeof MONTH_NAMES_AR]
    if (monthName) return `${monthName}/${parts[1]}`
  }
  return answer
}

const REVERSE_TEMPLATES: Record<number, (a: string) => string> = {
  1: (a) => `من وُلد في ${formatBirthdayWithMonthName(a)}؟`,
  2: (a) => `من لونه المفضل هو ${a}؟`,
  3: (a) => `من معدله في الثانوية العامة ${a}؟`,
  4: (a) => `من أفضل أصدقاؤه ${a}؟`,
  5: (a) => `من وجبته المفضلة هي ${a}؟`,
  6: (a) => `من يتمنى زيارة ${a}؟`,
  7: (a) => `من آيته المفضلة هي ${a}؟`,
  8: (a) => `من سورته المفضلة هي ${a}؟`,
  9: (a) => `من مقاس حذائه ${a}؟`,
  10: (a) => `من يريد أن يفعل أولاً: ${a}؟`,
}

function personalizeQuestion(template: string | null | undefined, questionText: string, contestantName: string): string {
  if (template) return template.replace('{name}', contestantName)
  return `سؤال عن ${contestantName}: ${questionText}`
}

function buildReverseQuestion(questionId: number, correctAnswer: string): string {
  const template = REVERSE_TEMPLATES[questionId]
  return template ? template(correctAnswer) : `من الإجابة الصحيحة هي ${correctAnswer}؟`
}

function getHelplineSetting(key: string): { cost: number; multiplier_reduction: number } {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (row) return JSON.parse(row.value)
  const defaults: Record<string, { cost: number; multiplier_reduction: number }> = {
    helpline_remove_two: { cost: 50, multiplier_reduction: 0.25 },
    helpline_same_person: { cost: 100, multiplier_reduction: 0.5 },
    helpline_opposing_team: { cost: 75, multiplier_reduction: 0.5 },
    helpline_wild: { cost: 200, multiplier_reduction: 0.5 },
  }
  return defaults[key] || { cost: 0, multiplier_reduction: 0 }
}

async function buildNormalQuestion(
  contestantId: number,
  questionId: number,
  wager: number,
  contestantName: string
) {
  const question = db.prepare('SELECT id, text, personalized_template FROM questions WHERE id = ?').get(questionId) as {
    id: number; text: string; personalized_template: string | null
  } | undefined
  if (!question) return null

  const correctRow = db.prepare('SELECT answer FROM answers WHERE contestant_id = ? AND question_id = ?')
    .get(contestantId, questionId) as { answer: string } | undefined
  if (!correctRow) return null

  const correctAnswer = correctRow.answer
  let questionText: string
  let options: Array<{ id: string; text: string; is_correct: boolean }>

  if (wager > 499) {
    questionText = buildReverseQuestion(questionId, correctAnswer)
    const allContestants = db.prepare('SELECT id, name FROM contestants ORDER BY id ASC').all() as Array<{ id: number; name: string }>
    if (allContestants.length < 2) return null
    const wrongNames = allContestants.filter(c => c.id !== contestantId).map(c => c.name).slice(0, 4)
    const allOptions = shuffle([
      { text: contestantName, is_correct: true },
      ...wrongNames.map(t => ({ text: t, is_correct: false })),
    ])
    options = allOptions.map((opt, i) => ({ id: OPTION_LABELS[i], text: opt.text, is_correct: opt.is_correct }))
  } else {
    questionText = personalizeQuestion(question.personalized_template, question.text, contestantName)
    const otherAnswers = db.prepare(`
      SELECT DISTINCT answer FROM answers WHERE question_id = ? AND contestant_id != ? AND answer != ? LIMIT 8
    `).all(questionId, contestantId, correctAnswer) as Array<{ answer: string }>

    const wrongAnswerTexts = otherAnswers.map(r => r.answer)
    let padIndex = 0
    while (wrongAnswerTexts.length < 4) {
      const fallback = FALLBACK_WRONG[padIndex % FALLBACK_WRONG.length]
      if (!wrongAnswerTexts.includes(fallback) && fallback !== correctAnswer) wrongAnswerTexts.push(fallback)
      padIndex++
      if (padIndex > 20) break
    }
    const finalWrong = wrongAnswerTexts.slice(0, 4)
    const allOptions = shuffle([
      { text: correctAnswer, is_correct: true },
      ...finalWrong.map(t => ({ text: t, is_correct: false })),
    ])
    options = allOptions.map((opt, i) => ({ id: OPTION_LABELS[i], text: opt.text, is_correct: opt.is_correct }))
  }

  return { questionText, options, correctAnswer }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type } = body

    if (!['same_person', 'opposing_team', 'remove_two'].includes(type)) {
      return NextResponse.json({ error: 'Invalid helpline type' }, { status: 400 })
    }

    const session = db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1').get() as {
      id: number; status: string; current_team: string;
      team_a_score: number; team_b_score: number;
      team_a_removes_used: number; team_b_removes_used: number;
      current_state: string
    } | undefined

    if (!session || session.status !== 'questioning') {
      return NextResponse.json({ error: 'Not in questioning state' }, { status: 400 })
    }

    const currentState = JSON.parse(session.current_state || '{}')
    const helplines_used: string[] = currentState.helplines_used || []

    // Enforce one helpline per question
    if (helplines_used.length > 0) {
      return NextResponse.json({ error: 'يمكن استخدام مساعدة واحدة فقط في كل سؤال' }, { status: 400 })
    }

    const settingKey = `helpline_${type === 'remove_two' ? 'remove_two' : type === 'same_person' ? 'same_person' : 'opposing_team'}`
    const setting = getHelplineSetting(settingKey)
    const costPoints = setting.cost
    const multiplierReduction = setting.multiplier_reduction

    const isTeamA = session.current_team === 'A'
    const teamBalance = isTeamA ? session.team_a_score : session.team_b_score

    if (teamBalance < costPoints) {
      return NextResponse.json({ error: `رصيد غير كافٍ. التكلفة: ${costPoints}, الرصيد: ${teamBalance}` }, { status: 400 })
    }

    const wager = currentState.wager || 100
    const currentMultiplier = currentState.reward_multiplier ?? 1.0
    const newMultiplier = Math.max(0.25, currentMultiplier - multiplierReduction)
    let newState = { ...currentState }

    if (type === 'remove_two') {
      const eliminated: string[] = currentState.eliminated_options || []
      const wrongOptions = currentState.options.filter(
        (o: { id: string; is_correct: boolean }) => !o.is_correct && !eliminated.includes(o.id)
      )

      if (wrongOptions.length < 2) {
        return NextResponse.json({ error: 'لا يوجد خيارات خاطئة كافية للحذف' }, { status: 400 })
      }

      const toRemove = shuffle(wrongOptions).slice(0, 2).map((o) => (o as { id: string }).id)
      newState.eliminated_options = [...eliminated, ...toRemove]
      newState.reward_multiplier = newMultiplier
      newState.helplines_used = [...helplines_used, type]

      // Deduct cost
      if (isTeamA) {
        db.prepare('UPDATE game_sessions SET team_a_score = team_a_score - ? WHERE id = ?').run(costPoints, session.id)
      } else {
        db.prepare('UPDATE game_sessions SET team_b_score = team_b_score - ? WHERE id = ?').run(costPoints, session.id)
      }

      db.prepare('UPDATE game_sessions SET current_state = ? WHERE id = ?').run(JSON.stringify(newState), session.id)

      return NextResponse.json({
        success: true,
        eliminated_options: newState.eliminated_options,
        options: newState.options,
        reward_multiplier: newState.reward_multiplier,
      })
    }

    // Question-changing helplines
    let targetContestantId: number
    let newQuestionId: number | null = null

    if (type === 'same_person') {
      targetContestantId = currentState.contestant_id

      const usedRows = db.prepare(`SELECT question_id FROM used_questions WHERE session_id = ? AND contestant_id = ?`)
        .all(session.id, targetContestantId) as Array<{ question_id: number }>
      const usedIds = new Set(usedRows.map(r => r.question_id))
      usedIds.add(currentState.question_id)

      const answeredQuestions = db.prepare(`
        SELECT q.id FROM questions q JOIN answers a ON a.question_id = q.id WHERE a.contestant_id = ?
      `).all(targetContestantId) as Array<{ id: number }>

      const available = answeredQuestions.filter(q => !usedIds.has(q.id))
      if (available.length === 0) {
        return NextResponse.json({ error: 'لا توجد أسئلة أخرى لهذا المتسابق' }, { status: 400 })
      }
      newQuestionId = available[Math.floor(Math.random() * available.length)].id

    } else if (type === 'opposing_team') {
      // Opposing team = the team being asked about (already the opposing team when this is called)
      const opposingTeam = session.current_team === 'A' ? 'B' : 'A'
      const opposingContestants = db.prepare('SELECT id FROM contestants WHERE team = ?').all(opposingTeam) as Array<{ id: number }>

      if (opposingContestants.length === 0) {
        return NextResponse.json({ error: 'لا يوجد متسابقون في الفريق المنافس' }, { status: 400 })
      }

      // Exclude current contestant, pick a different one
      const others = shuffle(opposingContestants.filter(c => c.id !== currentState.contestant_id))
      let found = false

      for (const c of others) {
        const answeredQuestions = db.prepare(`
          SELECT q.id FROM questions q JOIN answers a ON a.question_id = q.id WHERE a.contestant_id = ?
        `).all(c.id) as Array<{ id: number }>

        if (answeredQuestions.length > 0) {
          targetContestantId = c.id
          newQuestionId = answeredQuestions[Math.floor(Math.random() * answeredQuestions.length)].id
          found = true
          break
        }
      }

      if (!found) {
        // Fall back to any opposing contestant including current
        for (const c of shuffle(opposingContestants)) {
          const answeredQuestions = db.prepare(`
            SELECT q.id FROM questions q JOIN answers a ON a.question_id = q.id WHERE a.contestant_id = ?
          `).all(c.id) as Array<{ id: number }>

          if (answeredQuestions.length > 0) {
            targetContestantId = c.id
            newQuestionId = answeredQuestions[Math.floor(Math.random() * answeredQuestions.length)].id
            found = true
            break
          }
        }
      }

      if (!found) {
        return NextResponse.json({ error: 'لا توجد إجابات من الفريق المنافس' }, { status: 400 })
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

    const newHelplines = [...helplines_used, type]

    // Build new question for same_person and opposing_team
    const contestant = db.prepare('SELECT id, name FROM contestants WHERE id = ?').get(targetContestantId!) as { id: number; name: string }
    const result = await buildNormalQuestion(targetContestantId!, newQuestionId!, wager, contestant.name)

    if (!result) {
      return NextResponse.json({ error: 'Failed to build question' }, { status: 500 })
    }

    // Mark new question as used
    try {
      db.prepare(`INSERT OR IGNORE INTO used_questions (session_id, contestant_id, question_id) VALUES (?, ?, ?)`)
        .run(session.id, targetContestantId!, newQuestionId!)
    } catch { /* ignore */ }

    newState = {
      contestant_id: targetContestantId!,
      contestant_name: contestant.name,
      question_id: newQuestionId!,
      question_text: result.questionText,
      wager: currentState.wager,
      reward_multiplier: newMultiplier,
      options: result.options,
      eliminated_options: [],
      helplines_used: newHelplines,
      selected_option: null,
      last_result: null,
    }

    db.prepare('UPDATE game_sessions SET current_state = ?, last_question_id = ? WHERE id = ?')
      .run(JSON.stringify(newState), newQuestionId!, session.id)

    return NextResponse.json({
      success: true,
      question_text: result.questionText,
      contestant_name: contestant.name,
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
