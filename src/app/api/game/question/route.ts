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
  if (template) {
    return template.replace('{name}', contestantName)
  }
  return questionText
}

function buildReverseQuestion(questionId: number, correctAnswer: string, questionText: string): string {
  const template = REVERSE_TEMPLATES[questionId]
  return template ? template(correctAnswer) : `من الإجابة الصحيحة هي ${correctAnswer}؟`
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { contestant_id, question_id, wager: bodyWager, is_steal } = body

    if (!contestant_id) {
      return NextResponse.json({ error: 'contestant_id is required' }, { status: 400 })
    }

    const session = db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 1').get() as {
      id: number; status: string; current_team: string; current_state: string; last_question_id: number | null
      wager_usage: string; steal_used_a: number; steal_used_b: number; used_question_topics: string
    } | undefined

    if (!session) {
      return NextResponse.json({ error: 'No active game session' }, { status: 400 })
    }

    const contestant = db.prepare('SELECT * FROM contestants WHERE id = ?').get(contestant_id) as {
      id: number; name: string; team: string
    } | undefined

    if (!contestant) {
      return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
    }

    const opposingTeam = session.current_team === 'A' ? 'B' : 'A'
    if (contestant.team !== opposingTeam) {
      return NextResponse.json({ error: 'Questions must be about opposing team members' }, { status: 400 })
    }

    const currentState = JSON.parse(session.current_state || '{}')
    const wager = bodyWager ?? currentState.wager ?? 100
    const rewardMultiplier = currentState.reward_multiplier ?? 1.0
    const helplines_used = currentState.helplines_used || []

    // Check wager limits
    const wagerUsage: Record<string, Record<string, number>> = JSON.parse(session.wager_usage || '{}')
    const teamUsage = wagerUsage[session.current_team] || {}
    const wagerKey = String(wager)
    const currentCount = teamUsage[wagerKey] || 0
    const maxAllowed = wager >= 600 ? 1 : 2
    if (currentCount >= maxAllowed) {
      return NextResponse.json({ error: `لقد استخدمت هذه المراهنة الحد الأقصى المسموح به` }, { status: 400 })
    }

    // Validate steal
    const stealUsed = session.current_team === 'A' ? session.steal_used_a : session.steal_used_b
    const isSteal = !!is_steal && wager <= 500 && !stealUsed

    // Update wager usage
    if (!wagerUsage[session.current_team]) wagerUsage[session.current_team] = {}
    wagerUsage[session.current_team][wagerKey] = currentCount + 1

    const updatedState = { ...currentState, wager, reward_multiplier: rewardMultiplier, helplines_used, is_steal: isSteal }

    // Track globally used question topics for this session
    const usedTopics: string[] = JSON.parse(session.used_question_topics || '[]')

    // Get per-contestant used questions
    const usedRows = db.prepare(`
      SELECT question_id FROM used_questions WHERE session_id = ? AND contestant_id = ?
    `).all(session.id, contestant_id) as Array<{ question_id: number }>
    const usedQuestionIds = new Set(usedRows.map(r => r.question_id))

    // --- Custom player question (type: custom) ---
    type CustomQ = { id: number; question_text: string; correct_answer: string; wrong_answer_1: string; wrong_answer_2: string; wrong_answer_3: string; wrong_answer_4: string }
    const allCustom = db.prepare(`
      SELECT * FROM custom_player_questions WHERE contestant_id = ?
    `).all(contestant_id) as CustomQ[]

    const availableCustom = allCustom.filter(q => !usedTopics.includes(`cq_${q.id}`))

    // --- Standard questions ---
    const allQuestions = db.prepare('SELECT id, text, personalized_template FROM questions ORDER BY id ASC').all() as Array<{ id: number; text: string; personalized_template: string | null }>

    const answeredIds = new Set(
      (db.prepare('SELECT question_id FROM answers WHERE contestant_id = ?').all(contestant_id) as Array<{ question_id: number }>)
        .map(r => r.question_id)
    )

    // Available standard questions: answered by contestant, not used this turn for them, not used globally this session
    let availableStd = allQuestions.filter(q =>
      answeredIds.has(q.id) &&
      !usedQuestionIds.has(q.id) &&
      !usedTopics.includes(`q_${q.id}`)
    )

    // If globally all topics used, reset global filter for this contestant
    if (availableStd.length === 0 && availableCustom.length === 0) {
      // Fallback: only filter by per-contestant used
      availableStd = allQuestions.filter(q => answeredIds.has(q.id) && !usedQuestionIds.has(q.id))
    }

    // Prefer questions not recently used (last_question_id)
    const preferredStd = availableStd.filter(q => q.id !== session.last_question_id)
    const poolStd = preferredStd.length > 0 ? preferredStd : availableStd

    // Choose between custom and standard
    const useCustom = question_id == null && availableCustom.length > 0 && (poolStd.length === 0 || Math.random() < 0.3)

    let topicKey: string
    let isCustomQuestion = false

    if (question_id) {
      // Specific question requested (from helpline)
      const selectedQuestion = db.prepare('SELECT id, text, personalized_template FROM questions WHERE id = ?').get(question_id) as { id: number; text: string; personalized_template: string | null } | undefined
      if (!selectedQuestion) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

      const correctAnswerRow = db.prepare('SELECT answer FROM answers WHERE contestant_id = ? AND question_id = ?').get(contestant_id, selectedQuestion.id) as { answer: string } | undefined
      if (!correctAnswerRow) return NextResponse.json({ error: 'This contestant has not answered this question' }, { status: 400 })

      const correctAnswer = correctAnswerRow.answer
      let questionText: string
      let options: Array<{ id: string; text: string; is_correct: boolean }>
      let isReverseQuestion = false

      if (wager > 499) {
        isReverseQuestion = true
        questionText = buildReverseQuestion(selectedQuestion.id, correctAnswer, selectedQuestion.text)
        const allContestants = db.prepare('SELECT id, name FROM contestants ORDER BY id ASC').all() as Array<{ id: number; name: string }>
        const wrongNames = allContestants.filter(c => c.id !== contestant_id).map(c => c.name).slice(0, 4)
        const allOptions = shuffle([{ text: contestant.name, is_correct: true }, ...wrongNames.map(t => ({ text: t, is_correct: false }))])
        options = allOptions.map((opt, i) => ({ id: OPTION_LABELS[i], text: opt.text, is_correct: opt.is_correct }))
      } else {
        questionText = personalizeQuestion(selectedQuestion.personalized_template, selectedQuestion.text, contestant.name)
        const customWrong = db.prepare('SELECT wrong_answer FROM custom_wrong_answers WHERE contestant_id = ? AND question_id = ?').all(contestant_id, selectedQuestion.id) as Array<{ wrong_answer: string }>
        let wrongAnswerTexts = customWrong.map(r => r.wrong_answer)
        if (wrongAnswerTexts.length < 4) {
          const otherAnswers = db.prepare('SELECT DISTINCT answer FROM answers WHERE question_id = ? AND contestant_id != ? AND answer != ? LIMIT 8').all(selectedQuestion.id, contestant_id, correctAnswer) as Array<{ answer: string }>
          const otherFiltered = otherAnswers.map(r => r.answer).filter(a => !wrongAnswerTexts.includes(a))
          wrongAnswerTexts = [...wrongAnswerTexts, ...otherFiltered]
        }
        let padIndex = 0
        while (wrongAnswerTexts.length < 4) {
          const fallback = FALLBACK_WRONG[padIndex % FALLBACK_WRONG.length]
          if (!wrongAnswerTexts.includes(fallback) && fallback !== correctAnswer) wrongAnswerTexts.push(fallback)
          padIndex++
          if (padIndex > 20) break
        }
        const finalWrong = wrongAnswerTexts.slice(0, 4)
        const allOptions = shuffle([{ text: correctAnswer, is_correct: true }, ...finalWrong.map(t => ({ text: t, is_correct: false }))])
        options = allOptions.map((opt, i) => ({ id: OPTION_LABELS[i], text: opt.text, is_correct: opt.is_correct }))
      }

      topicKey = `q_${selectedQuestion.id}`
      try { db.prepare('INSERT OR IGNORE INTO used_questions (session_id, contestant_id, question_id) VALUES (?, ?, ?)').run(session.id, contestant_id, selectedQuestion.id) } catch { /* ignore */ }

      const newUsedTopics = usedTopics.includes(topicKey) ? usedTopics : [...usedTopics, topicKey]
      const newState = { ...updatedState, contestant_id, contestant_name: contestant.name, question_id: selectedQuestion.id, question_text: questionText, wager, reward_multiplier: rewardMultiplier, options, eliminated_options: [], helplines_used, selected_option: null, last_result: null, is_reverse_question: isReverseQuestion, is_custom_question: false }

      db.prepare('UPDATE game_sessions SET status = ?, current_state = ?, last_question_id = ?, wager_usage = ?, used_question_topics = ? WHERE id = ?')
        .run('questioning', JSON.stringify(newState), selectedQuestion.id, JSON.stringify(wagerUsage), JSON.stringify(newUsedTopics), session.id)

      return NextResponse.json({ question_text: questionText, options, contestant_name: contestant.name, contestant_id: contestant.id, question_id: selectedQuestion.id, wager, reward_multiplier: rewardMultiplier })
    }

    if (useCustom) {
      const customQ = availableCustom[Math.floor(Math.random() * availableCustom.length)]
      isCustomQuestion = true
      topicKey = `cq_${customQ.id}`

      const wrongAnswers = [customQ.wrong_answer_1, customQ.wrong_answer_2, customQ.wrong_answer_3, customQ.wrong_answer_4]
      const allOptions = shuffle([
        { text: customQ.correct_answer, is_correct: true },
        ...wrongAnswers.map(t => ({ text: t, is_correct: false })),
      ])
      const options = allOptions.map((opt, i) => ({ id: OPTION_LABELS[i], text: opt.text, is_correct: opt.is_correct }))

      const newUsedTopics = [...usedTopics, topicKey]
      const newState = { ...updatedState, contestant_id, contestant_name: contestant.name, question_id: -customQ.id, question_text: customQ.question_text, wager, reward_multiplier: rewardMultiplier, options, eliminated_options: [], helplines_used, selected_option: null, last_result: null, is_reverse_question: false, is_custom_question: true, custom_correct_answer: customQ.correct_answer }

      db.prepare('UPDATE game_sessions SET status = ?, current_state = ?, last_question_id = ?, wager_usage = ?, used_question_topics = ? WHERE id = ?')
        .run('questioning', JSON.stringify(newState), null, JSON.stringify(wagerUsage), JSON.stringify(newUsedTopics), session.id)

      return NextResponse.json({ question_text: customQ.question_text, options, contestant_name: contestant.name, contestant_id: contestant.id, question_id: -customQ.id, wager, reward_multiplier: rewardMultiplier })
    }

    // Standard question
    if (poolStd.length === 0) {
      return NextResponse.json({ error: 'No more questions available for this contestant' }, { status: 400 })
    }

    const selectedQuestion = poolStd[Math.floor(Math.random() * poolStd.length)]
    topicKey = `q_${selectedQuestion.id}`

    const correctAnswerRow = db.prepare('SELECT answer FROM answers WHERE contestant_id = ? AND question_id = ?').get(contestant_id, selectedQuestion.id) as { answer: string } | undefined
    if (!correctAnswerRow) return NextResponse.json({ error: 'This contestant has not answered this question' }, { status: 400 })

    const correctAnswer = correctAnswerRow.answer
    let questionText: string
    let options: Array<{ id: string; text: string; is_correct: boolean }>
    let isReverseQuestion = false

    if (wager > 499) {
      isReverseQuestion = true
      questionText = buildReverseQuestion(selectedQuestion.id, correctAnswer, selectedQuestion.text)
      const allContestants = db.prepare('SELECT id, name FROM contestants ORDER BY id ASC').all() as Array<{ id: number; name: string }>
      if (allContestants.length < 2) return NextResponse.json({ error: 'Not enough contestants for reverse question' }, { status: 400 })
      const wrongNames = allContestants.filter(c => c.id !== contestant_id).map(c => c.name).slice(0, 4)
      const allOpts = shuffle([{ text: contestant.name, is_correct: true }, ...wrongNames.map(t => ({ text: t, is_correct: false }))])
      options = allOpts.map((opt, i) => ({ id: OPTION_LABELS[i], text: opt.text, is_correct: opt.is_correct }))
    } else {
      questionText = personalizeQuestion(selectedQuestion.personalized_template, selectedQuestion.text, contestant.name)

      // Use custom wrong answers if available, otherwise fall back to other contestants' answers
      const customWrong = db.prepare('SELECT wrong_answer FROM custom_wrong_answers WHERE contestant_id = ? AND question_id = ?').all(contestant_id, selectedQuestion.id) as Array<{ wrong_answer: string }>
      let wrongAnswerTexts = customWrong.map(r => r.wrong_answer)

      if (wrongAnswerTexts.length < 4) {
        const otherAnswers = db.prepare('SELECT DISTINCT answer FROM answers WHERE question_id = ? AND contestant_id != ? AND answer != ? LIMIT 8').all(selectedQuestion.id, contestant_id, correctAnswer) as Array<{ answer: string }>
        const otherFiltered = otherAnswers.map(r => r.answer).filter(a => !wrongAnswerTexts.includes(a))
        wrongAnswerTexts = [...wrongAnswerTexts, ...otherFiltered]
      }

      let padIndex = 0
      while (wrongAnswerTexts.length < 4) {
        const fallback = FALLBACK_WRONG[padIndex % FALLBACK_WRONG.length]
        if (!wrongAnswerTexts.includes(fallback) && fallback !== correctAnswer) wrongAnswerTexts.push(fallback)
        padIndex++
        if (padIndex > 20) break
      }

      const finalWrong = wrongAnswerTexts.slice(0, 4)
      const allOpts = shuffle([{ text: correctAnswer, is_correct: true }, ...finalWrong.map(t => ({ text: t, is_correct: false }))])
      options = allOpts.map((opt, i) => ({ id: OPTION_LABELS[i], text: opt.text, is_correct: opt.is_correct }))
    }

    try { db.prepare('INSERT OR IGNORE INTO used_questions (session_id, contestant_id, question_id) VALUES (?, ?, ?)').run(session.id, contestant_id, selectedQuestion.id) } catch { /* ignore */ }

    const newUsedTopics = usedTopics.includes(topicKey) ? usedTopics : [...usedTopics, topicKey]
    const newState = { ...updatedState, contestant_id, contestant_name: contestant.name, question_id: selectedQuestion.id, question_text: questionText, wager, reward_multiplier: rewardMultiplier, options, eliminated_options: [], helplines_used, selected_option: null, last_result: null, is_reverse_question: isReverseQuestion, is_custom_question: false, original_answer: isReverseQuestion ? correctAnswer : undefined }

    db.prepare('UPDATE game_sessions SET status = ?, current_state = ?, last_question_id = ?, wager_usage = ?, used_question_topics = ? WHERE id = ?')
      .run('questioning', JSON.stringify(newState), selectedQuestion.id, JSON.stringify(wagerUsage), JSON.stringify(newUsedTopics), session.id)

    return NextResponse.json({ question_text: questionText, options, contestant_name: contestant.name, contestant_id: contestant.id, question_id: selectedQuestion.id, wager, reward_multiplier: rewardMultiplier })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
