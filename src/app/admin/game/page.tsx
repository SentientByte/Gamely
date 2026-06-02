'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

interface GameOption {
  id: string
  text: string
  is_correct: boolean
}

interface GameState {
  contestant_id?: number
  contestant_name?: string
  question_id?: number
  question_text?: string
  wager?: number
  reward_multiplier?: number
  options?: GameOption[]
  eliminated_options?: string[]
  helplines_used?: string[]
  selected_option?: string | null
  last_result?: {
    correct: boolean
    score_change: number
    correct_answer: string
    correct_option_id: string
  } | null
}

interface Session {
  id: number
  status: 'idle' | 'wagering' | 'questioning' | 'result' | 'finished'
  current_team: string
  team_a_score: number
  team_b_score: number
  team_a_removes_used: number
  team_b_removes_used: number
  current_state: GameState
  last_question_id: number | null
}

interface Contestant {
  id: number
  name: string
  team: string
}

const LABELS_AR = ['أ', 'ب', 'ج', 'د', 'هـ']

export default function GamePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [selectedContestant, setSelectedContestant] = useState<string>('')
  const [selectedWager, setSelectedWager] = useState<number>(100)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [startScoreA, setStartScoreA] = useState(0)
  const [startScoreB, setStartScoreB] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [currentContestantName, setCurrentContestantName] = useState<string>('')
  const [scoreAnimation, setScoreAnimation] = useState<'up' | 'down' | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/game/state')
      const data = await res.json()
      setSession(data.session)
    } catch { /* ignore */ }
  }, [])

  const fetchContestants = useCallback(async () => {
    try {
      const res = await fetch('/api/contestants')
      if (res.ok) {
        const data = await res.json()
        setContestants(data)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([fetchState(), fetchContestants()]).finally(() => setLoading(false))
    pollRef.current = setInterval(fetchState, 1500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchState, fetchContestants])

  async function apiCall(url: string, body?: object) {
    setActionLoading(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      await fetchState()
      return { ok: res.ok, data }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleStart() {
    await apiCall('/api/game/start', { team_a_score: startScoreA, team_b_score: startScoreB })
    setSelectedOption(null)
    setSelectedWager(100)
  }

  async function handleReset() {
    if (!confirm('إعادة ضبط اللعبة؟ سيتم حذف كل التقدم الحالي.')) return
    await apiCall('/api/game/reset')
    setSelectedOption(null)
    setSelectedWager(100)
    setCurrentQuestion('')
    setCurrentContestantName('')
  }

  async function handleSetWager() {
    await apiCall('/api/game/wager', { amount: selectedWager })
  }

  async function handleStartQuestion() {
    const contestantId = selectedContestant || getRandomContestantId()
    if (!contestantId) {
      alert('لا يوجد متسابقون في هذا الفريق')
      return
    }
    const { ok, data } = await apiCall('/api/game/question', { contestant_id: parseInt(contestantId) })
    if (ok) {
      setCurrentQuestion(data.question_text)
      setCurrentContestantName(data.contestant_name)
      setSelectedOption(null)
    } else {
      alert(data.error || 'حدث خطأ')
    }
  }

  async function handleSubmitAnswer() {
    if (!selectedOption) return
    const { ok, data } = await apiCall('/api/game/answer', { option_id: selectedOption })
    if (ok) {
      setScoreAnimation(data.correct ? 'up' : 'down')
      setTimeout(() => setScoreAnimation(null), 1500)
    }
  }

  async function handleNext() {
    await apiCall('/api/game/next')
    setSelectedOption(null)
    setCurrentQuestion('')
    setCurrentContestantName('')
  }

  async function handleFinish() {
    if (!confirm('إنهاء اللعبة وعرض النتائج النهائية؟')) return
    await apiCall('/api/game/finish')
  }

  async function handleHelpline(type: string) {
    const { ok, data } = await apiCall('/api/game/helpline', { type })
    if (ok) {
      if (data.question_text) {
        setCurrentQuestion(data.question_text)
        setCurrentContestantName(data.contestant_name)
      }
      setSelectedOption(null)
    } else {
      alert(data.error || 'حدث خطأ في استخدام المساعدة')
    }
  }

  function getRandomContestantId(): string {
    if (!session) return ''
    const team = session.current_team
    const members = contestants.filter(c => c.team === team)
    if (members.length === 0) return ''
    return members[Math.floor(Math.random() * members.length)].id.toString()
  }

  function getTeamContestants(team: string) {
    return contestants.filter(c => c.team === team)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0a28] flex items-center justify-center">
        <div className="text-white text-2xl font-arabic">جاري التحميل...</div>
      </div>
    )
  }

  const st = session?.current_state
  const options = st?.options || []
  const eliminated = st?.eliminated_options || []
  const helplines = st?.helplines_used || []
  const visibleOptions = options.filter(o => !eliminated.includes(o.id))
  const removesUsed = session?.current_team === 'A' ? session?.team_a_removes_used || 0 : session?.team_b_removes_used || 0

  return (
    <div dir="rtl" className="min-h-screen bg-[#0f0a28] font-arabic text-white select-none">
      {/* TOP BAR - Scores */}
      <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1a0a3a] via-[#0d1a4a] to-[#1a0a3a] border-b border-yellow-500/30 shadow-lg">
        {/* Team A - Right side (RTL) */}
        <div className={`flex items-center gap-3 ${session?.current_team === 'A' && session?.status !== 'idle' ? 'ring-2 ring-green-400 rounded-xl px-3 py-1' : 'px-3 py-1'}`}>
          <div className="text-right">
            <div className="text-xs text-green-300 font-medium">الفريق الأول</div>
            <div className={`text-3xl font-bold text-green-400 ${scoreAnimation === 'up' && session?.current_team === 'A' ? 'score-up' : ''} ${scoreAnimation === 'down' && session?.current_team === 'A' ? 'score-down' : ''}`}>
              {session?.team_a_score ?? 1000}
            </div>
          </div>
          <div className="w-12 h-12 bg-green-900/50 border border-green-600 rounded-xl flex items-center justify-center text-2xl">🟢</div>
        </div>

        {/* Center */}
        <div className="text-center">
          <div className="text-yellow-400 text-sm font-bold tracking-widest uppercase">الرصيد</div>
          <Link href="/admin/dashboard" className="text-slate-500 text-xs hover:text-slate-400 transition-colors">لوحة التحكم</Link>
        </div>

        {/* Team B - Left side (RTL) */}
        <div className={`flex items-center gap-3 ${session?.current_team === 'B' && session?.status !== 'idle' ? 'ring-2 ring-blue-400 rounded-xl px-3 py-1' : 'px-3 py-1'}`}>
          <div className="w-12 h-12 bg-blue-900/50 border border-blue-600 rounded-xl flex items-center justify-center text-2xl">🔵</div>
          <div className="text-left">
            <div className="text-xs text-blue-300 font-medium">الفريق الثاني</div>
            <div className={`text-3xl font-bold text-blue-400 ${scoreAnimation === 'up' && session?.current_team === 'B' ? 'score-up' : ''} ${scoreAnimation === 'down' && session?.current_team === 'B' ? 'score-down' : ''}`}>
              {session?.team_b_score ?? 1000}
            </div>
          </div>
        </div>
      </div>

      {/* Reset button */}
      <div className="flex justify-center py-2 bg-[#0a0820]">
        <button
          onClick={handleReset}
          disabled={actionLoading}
          className="text-xs text-slate-500 hover:text-red-400 px-4 py-1 rounded-lg hover:bg-red-900/20 transition-colors"
        >
          ⟳ إعادة ضبط اللعبة
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="p-4 max-w-5xl mx-auto">

        {/* ========== IDLE STATE ========== */}
        {(!session || session.status === 'idle') && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="text-center">
              <div className="text-7xl mb-4">🎮</div>
              <h1 className="text-5xl font-black text-yellow-400 mb-2">جيملي</h1>
              <p className="text-slate-400 text-xl">مسابقة الفريقين</p>
            </div>

            <div className="flex gap-6">
              <div className="text-center">
                <label className="text-green-300 text-sm mb-1 block">نقاط الفريق الأول</label>
                <input
                  type="number"
                  value={startScoreA}
                  onChange={e => setStartScoreA(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 w-28 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  min={0}
                  step={100}
                />
              </div>
              <div className="text-center">
                <label className="text-blue-300 text-sm mb-1 block">نقاط الفريق الثاني</label>
                <input
                  type="number"
                  value={startScoreB}
                  onChange={e => setStartScoreB(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 w-28 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                  step={100}
                />
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black text-2xl px-16 py-5 rounded-2xl shadow-2xl shadow-yellow-500/30 transition-all hover:scale-105 active:scale-95"
            >
              ابدأ اللعبة
            </button>
          </div>
        )}

        {/* ========== WAGERING STATE ========== */}
        {session && session.status === 'wagering' && (
          <div className="space-y-6">
            {/* Turn indicator */}
            <div className={`text-center py-4 rounded-2xl border ${session.current_team === 'A' ? 'bg-green-900/30 border-green-500/50 text-green-300' : 'bg-blue-900/30 border-blue-500/50 text-blue-300'}`}>
              <div className="text-3xl font-bold">
                {session.current_team === 'A' ? 'دور الفريق الأول 🟢' : 'دور الفريق الثاني 🔵'}
              </div>
            </div>

            {/* Contestant selector */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h2 className="text-yellow-400 font-bold text-lg mb-3">اختر المتسابق</h2>
              <select
                value={selectedContestant}
                onChange={e => setSelectedContestant(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">— اختيار عشوائي —</option>
                {getTeamContestants(session.current_team).map(c => (
                  <option key={c.id} value={c.id.toString()}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Wager selector */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h2 className="text-yellow-400 font-bold text-lg mb-3">حدد المراهنة</h2>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(w => (
                  <button
                    key={w}
                    onClick={() => setSelectedWager(w)}
                    className={`wager-btn py-3 rounded-xl font-bold text-sm border transition-all ${
                      selectedWager === w
                        ? 'bg-yellow-500 text-black border-yellow-400'
                        : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-yellow-500/50 hover:text-yellow-300'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSetWager}
                  disabled={actionLoading}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors text-lg"
                >
                  تأكيد المراهنة ({selectedWager})
                </button>
                <button
                  onClick={handleStartQuestion}
                  disabled={actionLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors text-lg"
                >
                  ابدأ السؤال ▶
                </button>
              </div>
              <p className="text-slate-500 text-xs mt-2 text-center">يمكنك تأكيد المراهنة ثم ابدأ السؤال، أو تخطي المراهنة والبدء مباشرة</p>
            </div>
          </div>
        )}

        {/* ========== QUESTIONING STATE ========== */}
        {session && session.status === 'questioning' && (
          <div className="space-y-4">
            {/* Question header */}
            <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-indigo-500/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`text-sm font-medium px-3 py-1 rounded-full ${session.current_team === 'A' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>
                  {session.current_team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'}
                </div>
                <div className="flex items-center gap-3">
                  {st?.reward_multiplier && st.reward_multiplier < 1 && (
                    <span className="text-orange-400 text-sm">
                      ×{st.reward_multiplier.toFixed(2)} مضاعف
                    </span>
                  )}
                  <span className="text-yellow-400 font-bold text-lg">
                    🎯 {st?.wager || 100} نقطة
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-slate-300 text-sm mb-1">سؤال عن:</p>
                <p className="text-yellow-300 text-xl font-bold mb-3">
                  {st?.contestant_name || currentContestantName || contestants.find(c => c.id === st?.contestant_id)?.name || '—'}
                </p>
                <p className="text-white text-2xl font-bold leading-relaxed">
                  {st?.question_text || currentQuestion || '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Options */}
              <div className="md:col-span-2 space-y-2">
                {visibleOptions.map((opt, idx) => {
                  const label = LABELS_AR[idx]
                  const isSelected = selectedOption === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedOption(opt.id)}
                      className={`option-btn w-full flex items-center gap-4 p-4 rounded-xl border-2 text-right text-lg transition-all ${
                        isSelected
                          ? 'border-yellow-400 bg-yellow-500/20 selected'
                          : 'border-slate-600 bg-slate-800/60 hover:border-slate-400'
                      }`}
                    >
                      <span className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg border-2 ${
                        isSelected ? 'border-yellow-400 bg-yellow-500 text-black' : 'border-slate-500 bg-slate-700 text-slate-300'
                      }`}>
                        {label}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  )
                })}

                {selectedOption && (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={actionLoading}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-xl py-4 rounded-xl mt-2 transition-all hover:scale-105"
                  >
                    تأكيد الإجابة ✓
                  </button>
                )}
              </div>

              {/* Helplines */}
              <div className="space-y-2">
                <h3 className="text-yellow-400 font-bold text-sm text-center mb-2">المساعدات</h3>

                <button
                  onClick={() => handleHelpline('same_person')}
                  disabled={actionLoading || helplines.includes('same_person')}
                  className={`w-full p-3 rounded-xl border text-sm text-right transition-all ${
                    helplines.includes('same_person')
                      ? 'border-slate-700 bg-slate-800/30 text-slate-600 cursor-not-allowed'
                      : 'border-purple-600/50 bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 hover:border-purple-500'
                  }`}
                >
                  <div className="font-bold">🔄 تبديل السؤال</div>
                  <div className="text-xs opacity-70 mt-0.5">نفس المتسابق • 100 نقطة • ↓50%</div>
                </button>

                <button
                  onClick={() => handleHelpline('opposing_team')}
                  disabled={actionLoading || helplines.includes('opposing_team')}
                  className={`w-full p-3 rounded-xl border text-sm text-right transition-all ${
                    helplines.includes('opposing_team')
                      ? 'border-slate-700 bg-slate-800/30 text-slate-600 cursor-not-allowed'
                      : 'border-cyan-600/50 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-500'
                  }`}
                >
                  <div className="font-bold">🎲 سؤال من الفريق الآخر</div>
                  <div className="text-xs opacity-70 mt-0.5">75 نقطة • ↓50%</div>
                </button>

                <button
                  onClick={() => handleHelpline('wild')}
                  disabled={actionLoading || helplines.includes('wild')}
                  className={`w-full p-3 rounded-xl border text-sm text-right transition-all ${
                    helplines.includes('wild')
                      ? 'border-slate-700 bg-slate-800/30 text-slate-600 cursor-not-allowed'
                      : 'border-amber-600/50 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50 hover:border-amber-500'
                  }`}
                >
                  <div className="font-bold">👶 سؤال عن الشخصية الخاصة</div>
                  <div className="text-xs opacity-70 mt-0.5">200 نقطة • ↓50%</div>
                </button>

                <button
                  onClick={() => handleHelpline('remove_two')}
                  disabled={actionLoading || removesUsed >= 2}
                  className={`w-full p-3 rounded-xl border text-sm text-right transition-all ${
                    removesUsed >= 2
                      ? 'border-slate-700 bg-slate-800/30 text-slate-600 cursor-not-allowed'
                      : 'border-red-600/50 bg-red-900/30 text-red-300 hover:bg-red-900/50 hover:border-red-500'
                  }`}
                >
                  <div className="font-bold">✂️ حذف إجابتين خاطئتين</div>
                  <div className="text-xs opacity-70 mt-0.5">50 نقطة • ↓25% ({removesUsed}/2 مستخدم)</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== RESULT STATE ========== */}
        {session && session.status === 'result' && st?.last_result && (
          <div className={`min-h-[60vh] flex flex-col items-center justify-center rounded-2xl p-8 ${
            st.last_result.correct ? 'correct-bg' : 'wrong-bg'
          }`}>
            <div className="text-center">
              <div className="text-8xl mb-4">
                {st.last_result.correct ? '✅' : '❌'}
              </div>
              <h2 className="text-5xl font-black mb-4">
                {st.last_result.correct ? 'إجابة صحيحة!' : 'إجابة خاطئة!'}
              </h2>

              <div className="bg-black/30 rounded-2xl p-5 mb-6 backdrop-blur-sm">
                <p className="text-slate-300 text-sm mb-1">الإجابة الصحيحة:</p>
                <p className="text-white text-2xl font-bold">{st.last_result.correct_answer}</p>
              </div>

              <div className={`text-4xl font-black mb-6 ${st.last_result.score_change >= 0 ? 'text-yellow-300' : 'text-red-300'}`}>
                {st.last_result.score_change >= 0 ? '+' : ''}{st.last_result.score_change} نقطة
              </div>

              <div className="flex gap-3 justify-center">
                <div className="bg-black/30 rounded-xl px-5 py-3 backdrop-blur-sm">
                  <div className="text-green-300 text-xs">الفريق الأول</div>
                  <div className="text-green-400 text-2xl font-bold">{session.team_a_score}</div>
                </div>
                <div className="bg-black/30 rounded-xl px-5 py-3 backdrop-blur-sm">
                  <div className="text-blue-300 text-xs">الفريق الثاني</div>
                  <div className="text-blue-400 text-2xl font-bold">{session.team_b_score}</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={handleNext}
                disabled={actionLoading}
                className="bg-white text-gray-900 font-black text-2xl px-14 py-4 rounded-2xl hover:bg-gray-100 transition-all hover:scale-105 shadow-2xl"
              >
                التالي ▶
              </button>
              <button
                onClick={handleFinish}
                disabled={actionLoading}
                className="bg-red-900/60 border border-red-700 text-red-300 font-bold text-lg px-8 py-4 rounded-2xl hover:bg-red-900 transition-all"
              >
                إنهاء اللعبة
              </button>
            </div>
          </div>
        )}

        {/* ========== FINISHED STATE ========== */}
        {session && session.status === 'finished' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="text-6xl">🏆</div>
            <h2 className="text-4xl font-black text-yellow-400">انتهت اللعبة!</h2>

            <div className="grid grid-cols-2 gap-6 my-4">
              <div className="text-center bg-green-900/40 border border-green-600 rounded-2xl p-6">
                <div className="text-green-300 text-lg mb-2">الفريق الأول</div>
                <div className="text-green-400 text-5xl font-black">{session.team_a_score}</div>
              </div>
              <div className="text-center bg-blue-900/40 border border-blue-600 rounded-2xl p-6">
                <div className="text-blue-300 text-lg mb-2">الفريق الثاني</div>
                <div className="text-blue-400 text-5xl font-black">{session.team_b_score}</div>
              </div>
            </div>

            <div className="text-3xl font-bold text-center">
              {session.team_a_score > session.team_b_score
                ? '🎉 الفريق الأول يفوز!'
                : session.team_b_score > session.team_a_score
                  ? '🎉 الفريق الثاني يفوز!'
                  : '🤝 تعادل!'}
            </div>

            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black text-xl px-12 py-4 rounded-2xl shadow-xl transition-all hover:scale-105"
            >
              لعبة جديدة
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
