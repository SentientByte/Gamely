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
  is_steal?: boolean
  last_result?: {
    correct: boolean
    score_change: number
    opposing_score_change?: number
    correct_answer: string
    correct_option_id: string
    was_steal?: boolean
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
  wager_usage: string
  steal_used_a: number
  steal_used_b: number
}

interface Contestant {
  id: number
  name: string
  team: string
}

interface HelplineSetting {
  cost: number
  multiplier_reduction: number
}

interface Settings {
  helpline_remove_two: HelplineSetting
  helpline_same_person: HelplineSetting
  helpline_opposing_team: HelplineSetting
  helpline_wild: HelplineSetting
}

const LABELS_AR = ['أ', 'ب', 'ج', 'د', 'هـ']
const WAGER_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]

const DEFAULT_SETTINGS: Settings = {
  helpline_remove_two: { cost: 50, multiplier_reduction: 0.25 },
  helpline_same_person: { cost: 100, multiplier_reduction: 0.5 },
  helpline_opposing_team: { cost: 75, multiplier_reduction: 0.5 },
  helpline_wild: { cost: 200, multiplier_reduction: 0.5 },
}

function playRingSound() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const times = [0, 0.15, 0.3]
    times.forEach(offset => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1047, ctx.currentTime + offset)
      osc.frequency.exponentialRampToValueAtTime(523, ctx.currentTime + offset + 0.4)
      gain.gain.setValueAtTime(0.4, ctx.currentTime + offset)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.5)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.5)
    })
  } catch { /* ignore */ }
}

export default function GamePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [selectedContestant, setSelectedContestant] = useState<string>('')
  const [selectedWager, setSelectedWager] = useState<number>(100)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [stealMode, setStealMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [startScoreA, setStartScoreA] = useState(0)
  const [startScoreB, setStartScoreB] = useState(0)
  const [teamAIds, setTeamAIds] = useState<number[]>([])
  const [teamBIds, setTeamBIds] = useState<number[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [currentContestantName, setCurrentContestantName] = useState<string>('')
  const [scoreAnimation, setScoreAnimation] = useState<'up' | 'down' | null>(null)
  const [timeLeft, setTimeLeft] = useState(45)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const prevQuestionIdRef = useRef<number | undefined>(undefined)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/game/state', { credentials: 'include' })
      const data = await res.json()
      setSession(data.session)
    } catch { /* ignore */ }
  }, [])

  const fetchContestants = useCallback(async () => {
    try {
      const res = await fetch('/api/contestants', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setContestants(data)
        setTeamAIds(data.filter((c: Contestant) => c.team === 'A').map((c: Contestant) => c.id))
        setTeamBIds(data.filter((c: Contestant) => c.team === 'B').map((c: Contestant) => c.id))
      }
    } catch { /* ignore */ }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSettings({ ...DEFAULT_SETTINGS, ...data })
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([fetchState(), fetchContestants(), fetchSettings()]).finally(() => setLoading(false))
    pollRef.current = setInterval(fetchState, 1500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchState, fetchContestants, fetchSettings])

  // Timer for questioning state
  useEffect(() => {
    if (session?.status === 'questioning') {
      const qId = session.current_state?.question_id
      if (qId !== prevQuestionIdRef.current) {
        prevQuestionIdRef.current = qId
        setTimeLeft(45)
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current!)
              playRingSound()
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      prevQuestionIdRef.current = undefined
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [session?.status, session?.current_state?.question_id])

  async function apiCall(url: string, body?: object) {
    setActionLoading(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    const { ok, data } = await apiCall('/api/game/start', {
      team_a_score: startScoreA,
      team_b_score: startScoreB,
      team_a_ids: teamAIds,
      team_b_ids: teamBIds,
    })
    if (ok) {
      await fetchContestants()
      setSelectedOption(null)
      setSelectedWager(100)
      setStealMode(false)
    } else {
      alert(data.error || 'حدث خطأ')
    }
  }

  async function handleReset() {
    if (!confirm('إعادة ضبط اللعبة؟ سيتم حذف كل التقدم الحالي.')) return
    await apiCall('/api/game/reset')
    setSelectedOption(null)
    setSelectedWager(100)
    setCurrentQuestion('')
    setCurrentContestantName('')
    setStealMode(false)
  }

  async function handleStartQuestion() {
    const opposingTeam = session?.current_team === 'A' ? 'B' : 'A'
    const contestantId = selectedContestant || getRandomOpposingContestantId(opposingTeam)
    if (!contestantId) {
      alert('لا يوجد متسابقون في الفريق المنافس')
      return
    }
    const { ok, data } = await apiCall('/api/game/question', {
      contestant_id: parseInt(contestantId),
      wager: selectedWager,
      is_steal: stealMode,
    })
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
    setSelectedContestant('')
    setSelectedWager(100)
    setStealMode(false)
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

  function getRandomOpposingContestantId(opposingTeam: string): string {
    const members = contestants.filter(c => c.team === opposingTeam)
    if (members.length === 0) return ''
    return members[Math.floor(Math.random() * members.length)].id.toString()
  }

  function getOpposingContestants(): Contestant[] {
    if (!session) return []
    const opposingTeam = session.current_team === 'A' ? 'B' : 'A'
    return contestants.filter(c => c.team === opposingTeam)
  }

  // Parse wager usage from session
  function getWagerUsage(): Record<string, Record<string, number>> {
    if (!session?.wager_usage) return {}
    try { return JSON.parse(session.wager_usage) } catch { return {} }
  }

  function getWagerCount(team: string, wager: number): number {
    const usage = getWagerUsage()
    return usage[team]?.[String(wager)] || 0
  }

  function getWagerLimit(wager: number): number {
    return wager >= 600 ? 1 : 2
  }

  const unassignedContestants = contestants.filter(c => c.team !== 'WILD' && !teamAIds.includes(c.id) && !teamBIds.includes(c.id))

  function assignToTeam(contestantId: number, team: 'A' | 'B') {
    setTeamAIds(prev => prev.filter(id => id !== contestantId))
    setTeamBIds(prev => prev.filter(id => id !== contestantId))
    if (team === 'A') setTeamAIds(prev => [...prev, contestantId])
    else setTeamBIds(prev => [...prev, contestantId])
  }

  function unassign(contestantId: number) {
    setTeamAIds(prev => prev.filter(id => id !== contestantId))
    setTeamBIds(prev => prev.filter(id => id !== contestantId))
  }

  function getContestantName(id: number): string {
    return contestants.find(c => c.id === id)?.name || '—'
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
  const helplineUsed = helplines.length > 0
  const wager = st?.wager || 100
  const multiplier = st?.reward_multiplier ?? 1.0
  const correctPoints = Math.round(wager * multiplier)
  const incorrectPoints = Math.round(wager * 0.5)
  const currentTeam = session?.current_team || 'A'
  const stealUsed = currentTeam === 'A' ? (session?.steal_used_a || 0) : (session?.steal_used_b || 0)
  const canSteal = !stealUsed && selectedWager <= 500

  // Timer color
  const timerColor = timeLeft > 20 ? 'text-green-400' : timeLeft > 10 ? 'text-yellow-400' : 'text-red-400'
  const timerBg = timeLeft > 20 ? 'bg-green-900/30 border-green-600/50' : timeLeft > 10 ? 'bg-yellow-900/30 border-yellow-600/50' : 'bg-red-900/40 border-red-600/60'

  return (
    <div dir="rtl" className="min-h-screen bg-[#0f0a28] font-arabic text-white select-none">
      {/* TOP BAR */}
      <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1a0a3a] via-[#0d1a4a] to-[#1a0a3a] border-b border-yellow-500/30 shadow-lg">
        <div className={`flex items-center gap-3 ${session?.current_team === 'A' && session?.status !== 'idle' ? 'ring-2 ring-green-400 rounded-xl px-3 py-1' : 'px-3 py-1'}`}>
          <div className="text-right">
            <div className="text-xs text-green-300 font-medium">الفريق الأول</div>
            <div className={`text-3xl font-bold text-green-400 ${scoreAnimation === 'up' && session?.current_team === 'A' ? 'score-up' : ''} ${scoreAnimation === 'down' && session?.current_team === 'A' ? 'score-down' : ''}`}>
              {session?.team_a_score ?? 0}
            </div>
          </div>
          <div className="w-12 h-12 bg-green-900/50 border border-green-600 rounded-xl flex items-center justify-center text-2xl">🟢</div>
        </div>

        <div className="text-center">
          <div className="text-yellow-400 text-sm font-bold tracking-widest uppercase">الرصيد</div>
          <Link href="/admin/dashboard" className="text-slate-500 text-xs hover:text-slate-400 transition-colors">لوحة التحكم</Link>
        </div>

        <div className={`flex items-center gap-3 ${session?.current_team === 'B' && session?.status !== 'idle' ? 'ring-2 ring-blue-400 rounded-xl px-3 py-1' : 'px-3 py-1'}`}>
          <div className="w-12 h-12 bg-blue-900/50 border border-blue-600 rounded-xl flex items-center justify-center text-2xl">🔵</div>
          <div className="text-left">
            <div className="text-xs text-blue-300 font-medium">الفريق الثاني</div>
            <div className={`text-3xl font-bold text-blue-400 ${scoreAnimation === 'up' && session?.current_team === 'B' ? 'score-up' : ''} ${scoreAnimation === 'down' && session?.current_team === 'B' ? 'score-down' : ''}`}>
              {session?.team_b_score ?? 0}
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

      <div className="p-4 max-w-5xl mx-auto">

        {/* ========== IDLE STATE ========== */}
        {(!session || session.status === 'idle') && (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="text-center">
              <div className="text-6xl mb-2">🎮</div>
              <h1 className="text-4xl font-black text-yellow-400 mb-1">جيملي</h1>
              <p className="text-slate-400">مسابقة الفريقين</p>
            </div>

            <div className="flex gap-6">
              <div className="text-center">
                <label className="text-green-300 text-sm mb-1 block">نقاط الفريق الأول</label>
                <input type="number" value={startScoreA} onChange={e => setStartScoreA(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 w-28 text-center focus:outline-none focus:ring-2 focus:ring-green-500" min={0} step={100} />
              </div>
              <div className="text-center">
                <label className="text-blue-300 text-sm mb-1 block">نقاط الفريق الثاني</label>
                <input type="number" value={startScoreB} onChange={e => setStartScoreB(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 w-28 text-center focus:outline-none focus:ring-2 focus:ring-blue-500" min={0} step={100} />
              </div>
            </div>

            <div className="w-full max-w-3xl">
              <h2 className="text-yellow-400 font-bold text-lg mb-3 text-center">توزيع المتسابقين على الفريقين</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-900/20 border border-green-600/40 rounded-2xl p-3">
                  <div className="text-green-400 font-bold text-center mb-2">🟢 الفريق الأول</div>
                  <div className="space-y-1 min-h-[60px]">
                    {teamAIds.map(id => (
                      <div key={id} className="flex items-center justify-between bg-green-900/40 border border-green-600/30 rounded-lg px-2 py-1.5">
                        <span className="text-green-200 text-sm">{getContestantName(id)}</span>
                        <button onClick={() => unassign(id)} className="text-slate-500 hover:text-red-400 text-xs ml-1">✕</button>
                      </div>
                    ))}
                    {teamAIds.length === 0 && <div className="text-slate-600 text-xs text-center py-3">اضغط على اسم لإضافته</div>}
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-600/40 rounded-2xl p-3">
                  <div className="text-slate-400 font-bold text-center mb-2">المتسابقون</div>
                  <div className="space-y-1 min-h-[60px]">
                    {unassignedContestants.map(c => (
                      <div key={c.id} className="bg-slate-700/60 border border-slate-600/30 rounded-lg px-2 py-1.5">
                        <div className="text-white text-sm text-center mb-1">{c.name}</div>
                        <div className="flex gap-1">
                          <button onClick={() => assignToTeam(c.id, 'A')} className="flex-1 text-xs bg-green-800/60 hover:bg-green-700 text-green-300 rounded py-0.5 transition-colors">← أ</button>
                          <button onClick={() => assignToTeam(c.id, 'B')} className="flex-1 text-xs bg-blue-800/60 hover:bg-blue-700 text-blue-300 rounded py-0.5 transition-colors">ب →</button>
                        </div>
                      </div>
                    ))}
                    {unassignedContestants.length === 0 && <div className="text-slate-600 text-xs text-center py-3">جميع المتسابقين وزّعوا</div>}
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-600/40 rounded-2xl p-3">
                  <div className="text-blue-400 font-bold text-center mb-2">🔵 الفريق الثاني</div>
                  <div className="space-y-1 min-h-[60px]">
                    {teamBIds.map(id => (
                      <div key={id} className="flex items-center justify-between bg-blue-900/40 border border-blue-600/30 rounded-lg px-2 py-1.5">
                        <span className="text-blue-200 text-sm">{getContestantName(id)}</span>
                        <button onClick={() => unassign(id)} className="text-slate-500 hover:text-red-400 text-xs ml-1">✕</button>
                      </div>
                    ))}
                    {teamBIds.length === 0 && <div className="text-slate-600 text-xs text-center py-3">اضغط على اسم لإضافته</div>}
                  </div>
                </div>
              </div>
              <p className="text-slate-500 text-xs text-center mt-2">سيقرر النظام تلقائياً أي فريق يبدأ أولاً</p>
            </div>

            <button onClick={handleStart} disabled={actionLoading || teamAIds.length === 0 || teamBIds.length === 0}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-2xl px-16 py-5 rounded-2xl shadow-2xl shadow-yellow-500/30 transition-all hover:scale-105 active:scale-95">
              ابدأ اللعبة
            </button>
          </div>
        )}

        {/* ========== WAGERING STATE ========== */}
        {session && session.status === 'wagering' && (
          <div className="space-y-6">
            <div className={`text-center py-4 rounded-2xl border ${session.current_team === 'A' ? 'bg-green-900/30 border-green-500/50 text-green-300' : 'bg-blue-900/30 border-blue-500/50 text-blue-300'}`}>
              <div className="text-3xl font-bold">
                {session.current_team === 'A' ? 'دور الفريق الأول 🟢' : 'دور الفريق الثاني 🔵'}
              </div>
              <div className="text-sm mt-1 opacity-70">
                الأسئلة ستكون عن {session.current_team === 'A' ? 'الفريق الثاني 🔵' : 'الفريق الأول 🟢'}
              </div>
            </div>

            {/* Opponent contestant selector */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h2 className="text-yellow-400 font-bold text-lg mb-3">اختر المتسابق (من الفريق المنافس)</h2>
              <select value={selectedContestant} onChange={e => setSelectedContestant(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500">
                <option value="">— اختيار عشوائي —</option>
                {getOpposingContestants().map(c => (
                  <option key={c.id} value={c.id.toString()}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Wager selector */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h2 className="text-yellow-400 font-bold text-lg mb-3">حدد المراهنة</h2>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {WAGER_OPTIONS.map(w => {
                  const count = getWagerCount(currentTeam, w)
                  const limit = getWagerLimit(w)
                  const isDisabled = count >= limit
                  const isSelected = selectedWager === w
                  return (
                    <button key={w} onClick={() => !isDisabled && setSelectedWager(w)} disabled={isDisabled}
                      className={`wager-btn py-3 rounded-xl font-bold text-sm border transition-all relative ${
                        isDisabled
                          ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed opacity-50'
                          : isSelected
                            ? 'bg-yellow-500 text-black border-yellow-400'
                            : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-yellow-500/50 hover:text-yellow-300'
                      }`}>
                      {w}
                      <div className={`text-xs mt-0.5 ${isDisabled ? 'text-slate-600' : isSelected ? 'text-black/70' : 'text-slate-500'}`}>
                        {count}/{limit}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Steal option */}
              <div className={`mb-4 rounded-xl border p-3 transition-all ${stealMode ? 'bg-orange-900/40 border-orange-500/70' : 'bg-slate-700/40 border-slate-600/50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-orange-300">⚔️ وضع السرقة</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      صح: تسرق النقاط من الفريق المنافس • خطأ: يحصل المنافس على 1.5× النقاط
                      {!canSteal && stealUsed ? ' (مستخدم)' : !canSteal ? ' (متاح للمراهنات ≤500 فقط)' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => canSteal && setStealMode(s => !s)}
                    disabled={!canSteal}
                    className={`w-14 h-7 rounded-full transition-all relative ${
                      stealMode ? 'bg-orange-500' : 'bg-slate-600'
                    } ${!canSteal ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${stealMode ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <button onClick={handleStartQuestion} disabled={actionLoading}
                className={`w-full font-bold py-4 rounded-xl transition-colors text-xl ${stealMode ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'}`}>
                {stealMode ? '⚔️ ابدأ السؤال بالسرقة' : 'ابدأ السؤال ▶'} ({selectedWager} نقطة)
              </button>
            </div>
          </div>
        )}

        {/* ========== QUESTIONING STATE ========== */}
        {session && session.status === 'questioning' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-indigo-500/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-medium px-3 py-1 rounded-full ${session.current_team === 'A' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    {session.current_team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'}
                  </div>
                  {st?.is_steal && (
                    <span className="text-xs bg-orange-900/50 text-orange-300 border border-orange-600/50 px-2 py-0.5 rounded-full">⚔️ سرقة</span>
                  )}
                </div>

                {/* Timer */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${timerBg}`}>
                  <span className="text-sm text-slate-400">⏱</span>
                  <span className={`text-2xl font-black tabular-nums ${timerColor}`}>{timeLeft}</span>
                </div>

                <div className="flex items-center gap-3">
                  {multiplier < 1 && (
                    <span className="text-orange-400 text-sm">×{multiplier.toFixed(2)} مضاعف</span>
                  )}
                  <span className="text-yellow-400 font-bold text-lg">🎯 {wager} نقطة</span>
                </div>
              </div>

              {/* Points info */}
              <div className="flex justify-center gap-4 mb-3">
                <div className="flex items-center gap-1.5 bg-emerald-900/30 border border-emerald-600/40 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-emerald-400 font-bold">+{correctPoints}</span>
                  <span className="text-slate-400">إجابة صحيحة</span>
                </div>
                <div className="flex items-center gap-1.5 bg-red-900/30 border border-red-600/40 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-red-400 font-bold">-{incorrectPoints}</span>
                  <span className="text-slate-400">إجابة خاطئة</span>
                </div>
                {st?.is_steal && (
                  <div className="flex items-center gap-1.5 bg-orange-900/30 border border-orange-600/40 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-orange-300 text-xs">⚔️ سرقة نشطة</span>
                  </div>
                )}
              </div>

              <div className="text-center">
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
                    <button key={opt.id} onClick={() => setSelectedOption(opt.id)}
                      className={`option-btn w-full flex items-center gap-4 p-4 rounded-xl border-2 text-right text-lg transition-all ${
                        isSelected ? 'border-yellow-400 bg-yellow-500/20 selected' : 'border-slate-600 bg-slate-800/60 hover:border-slate-400'
                      }`}>
                      <span className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg border-2 ${
                        isSelected ? 'border-yellow-400 bg-yellow-500 text-black' : 'border-slate-500 bg-slate-700 text-slate-300'
                      }`}>{label}</span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  )
                })}

                {selectedOption && (
                  <button onClick={handleSubmitAnswer} disabled={actionLoading}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-xl py-4 rounded-xl mt-2 transition-all hover:scale-105">
                    تأكيد الإجابة ✓
                  </button>
                )}
              </div>

              {/* Helplines */}
              <div className="space-y-2">
                <h3 className="text-yellow-400 font-bold text-sm text-center mb-2">المساعدات (واحدة فقط)</h3>

                <button onClick={() => handleHelpline('same_person')} disabled={actionLoading || helplineUsed}
                  className={`w-full p-3 rounded-xl border text-sm text-right transition-all ${helplineUsed ? 'border-slate-700 bg-slate-800/30 text-slate-600 cursor-not-allowed' : 'border-purple-600/50 bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 hover:border-purple-500'}`}>
                  <div className="font-bold">🔄 تبديل السؤال</div>
                  <div className="text-xs opacity-70 mt-0.5">نفس المتسابق • {settings.helpline_same_person.cost} نقطة • ↓{Math.round(settings.helpline_same_person.multiplier_reduction * 100)}%</div>
                </button>

                <button onClick={() => handleHelpline('opposing_team')} disabled={actionLoading || helplineUsed}
                  className={`w-full p-3 rounded-xl border text-sm text-right transition-all ${helplineUsed ? 'border-slate-700 bg-slate-800/30 text-slate-600 cursor-not-allowed' : 'border-cyan-600/50 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-500'}`}>
                  <div className="font-bold">🎲 متسابق مختلف</div>
                  <div className="text-xs opacity-70 mt-0.5">{settings.helpline_opposing_team.cost} نقطة • ↓{Math.round(settings.helpline_opposing_team.multiplier_reduction * 100)}%</div>
                </button>

                <button onClick={() => handleHelpline('wild')} disabled={actionLoading || helplineUsed}
                  className={`w-full p-3 rounded-xl border text-sm text-right transition-all ${helplineUsed ? 'border-slate-700 bg-slate-800/30 text-slate-600 cursor-not-allowed' : 'border-amber-600/50 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50 hover:border-amber-500'}`}>
                  <div className="font-bold">👶 سؤال عن الشخصية الخاصة</div>
                  <div className="text-xs opacity-70 mt-0.5">{settings.helpline_wild.cost} نقطة • ↓{Math.round(settings.helpline_wild.multiplier_reduction * 100)}%</div>
                </button>

                <button onClick={() => handleHelpline('remove_two')} disabled={actionLoading || helplineUsed}
                  className={`w-full p-3 rounded-xl border text-sm text-right transition-all ${helplineUsed ? 'border-slate-700 bg-slate-800/30 text-slate-600 cursor-not-allowed' : 'border-red-600/50 bg-red-900/30 text-red-300 hover:bg-red-900/50 hover:border-red-500'}`}>
                  <div className="font-bold">✂️ حذف إجابتين خاطئتين</div>
                  <div className="text-xs opacity-70 mt-0.5">{settings.helpline_remove_two.cost} نقطة • ↓{Math.round(settings.helpline_remove_two.multiplier_reduction * 100)}%</div>
                </button>

                {helplineUsed && <div className="text-center text-slate-500 text-xs mt-1">تم استخدام المساعدة لهذا السؤال</div>}
              </div>
            </div>
          </div>
        )}

        {/* ========== RESULT STATE ========== */}
        {session && session.status === 'result' && st?.last_result && (
          <div className={`min-h-[60vh] flex flex-col items-center justify-center rounded-2xl p-8 ${st.last_result.correct ? 'correct-bg' : 'wrong-bg'}`}>
            <div className="text-center">
              <div className="text-8xl mb-4">{st.last_result.correct ? '✅' : '❌'}</div>
              <h2 className="text-5xl font-black mb-4">{st.last_result.correct ? 'إجابة صحيحة!' : 'إجابة خاطئة!'}</h2>

              {st.last_result.was_steal && (
                <div className="mb-3 bg-orange-900/40 border border-orange-600/50 rounded-xl px-4 py-2 text-orange-300 text-sm">
                  ⚔️ وضع السرقة {st.last_result.correct ? `— سُرقت ${Math.abs(st.last_result.opposing_score_change || 0)} نقطة من المنافس` : `— حصل المنافس على ${st.last_result.opposing_score_change || 0} نقطة`}
                </div>
              )}

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
              <button onClick={handleNext} disabled={actionLoading}
                className="bg-white text-gray-900 font-black text-2xl px-14 py-4 rounded-2xl hover:bg-gray-100 transition-all hover:scale-105 shadow-2xl">
                التالي ▶
              </button>
              <button onClick={handleFinish} disabled={actionLoading}
                className="bg-red-900/60 border border-red-700 text-red-300 font-bold text-lg px-8 py-4 rounded-2xl hover:bg-red-900 transition-all">
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

            <button onClick={handleStart} disabled={actionLoading}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black text-xl px-12 py-4 rounded-2xl shadow-xl transition-all hover:scale-105">
              لعبة جديدة
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
