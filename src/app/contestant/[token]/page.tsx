'use client'

import { useState, useEffect } from 'react'

interface Question {
  id: number
  text: string
  existing_answer: string | null
  answer_id: number | null
}

interface Contestant {
  id: number
  name: string
  team: string
}

interface PageData {
  contestant: Contestant
  questions: Question[]
}

export default function ContestantPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<PageData | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [dateAnswers, setDateAnswers] = useState<Record<number, { month: string; day: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    fetchData()
  }, [params.token])

  async function fetchData() {
    try {
      const res = await fetch(`/api/contestant/${params.token}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) throw new Error('Server error')
      const d: PageData = await res.json()
      setData(d)
      // Pre-fill existing answers
      const existing: Record<number, string> = {}
      const existingDates: Record<number, { month: string; day: string }> = {}
      for (const q of d.questions) {
        if (q.existing_answer) {
          existing[q.id] = q.existing_answer
          // For question 1 (birth date), parse month/day if exists
          if (q.id === 1 && q.existing_answer) {
            const parts = q.existing_answer.split('/')
            if (parts.length === 2) {
              existingDates[q.id] = { month: parts[0], day: parts[1] }
            }
          }
        }
      }
      setAnswers(existing)
      setDateAnswers(existingDates)
    } catch {
      setError('حدث خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    const errors: Record<number, string> = {}

    try {
      const answersArray = (data?.questions || [])
        .map(q => {
          const qid = q.id

          // For question 1 (birth date), use dateAnswers state
          if (qid === 1) {
            const d = dateAnswers[qid]
            if (d?.month && d?.day) {
              return { question_id: qid, answer: `${d.month}/${d.day}` }
            }
            return null
          }

          const v = answers[qid] || ''
          if (!v.trim()) return null

          // For question 3 (GPA), validate it's between 50-99
          if (qid === 3) {
            const num = parseInt(v.trim())
            if (isNaN(num) || num < 50 || num > 99) {
              errors[qid] = 'يجب أن يكون الرقم بين 50 و 99'
              return null
            }
          }

          return { question_id: qid, answer: v.trim() }
        })
        .filter((item): item is { question_id: number; answer: string } => item !== null)

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors)
        setSaving(false)
        return
      }
      setValidationErrors({})

      const res = await fetch(`/api/contestant/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray }),
      })

      if (res.ok) {
        setSaved(true)
        fetchData()
        setTimeout(() => setSaved(false), 3000)
      } else {
        const d = await res.json()
        setError(d.error || 'حدث خطأ في الحفظ')
      }
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setSaving(false)
    }
  }

  const teamLabel: Record<string, { label: string; color: string }> = {
    A: { label: 'الفريق الأول', color: 'text-green-400' },
    B: { label: 'الفريق الثاني', color: 'text-blue-400' },
    WILD: { label: 'الشخصية الخاصة', color: 'text-amber-400' },
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center" dir="rtl">
        <div className="text-white text-xl font-arabic">جاري التحميل...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white font-arabic">الرابط غير صحيح</h1>
          <p className="text-slate-400 mt-2 font-arabic">لا يوجد متسابق بهذا الرابط</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center" dir="rtl">
        <div className="text-red-400 font-arabic">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const teamInfo = teamLabel[data.contestant.team] || { label: data.contestant.team, color: 'text-white' }
  const answeredCount = data.questions.filter(q => answers[q.id]?.trim()).length

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-[#0f0a28] to-[#1a1040] font-arabic">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border-b border-yellow-500/30 px-4 py-5 text-center">
        <div className="text-3xl mb-2">🎮</div>
        <h1 className="text-2xl font-black text-white">{data.contestant.name}</h1>
        <p className={`text-lg font-medium ${teamInfo.color}`}>{teamInfo.label}</p>
        <p className="text-slate-400 text-sm mt-1">
          {answeredCount} / {data.questions.length} إجابات مكتملة
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 pb-24 space-y-4">

        {data.questions.map((q, idx) => {
          const hasAnswer = q.existing_answer !== null
          const currentValue = answers[q.id] || ''
          const isModified = currentValue !== (q.existing_answer || '')
          const hasError = validationErrors[q.id]

          // Question 1: Birth date with month/day dropdowns
          if (q.id === 1) {
            const dateVal = dateAnswers[q.id] || { month: '', day: '' }
            return (
              <div
                key={q.id}
                className={`bg-slate-800/70 border rounded-2xl p-5 transition-colors ${
                  hasAnswer ? 'border-emerald-700/50' : 'border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <label className="text-white text-lg font-medium leading-relaxed flex-1">
                    <span className="text-yellow-400 ml-2">{idx + 1}.</span>
                    {q.text}
                  </label>
                  {hasAnswer && (
                    <span className="text-emerald-400 text-xs bg-emerald-900/40 px-2 py-1 rounded-full flex-shrink-0">
                      ✓ تمت الإجابة
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <select
                    value={dateVal.month}
                    onChange={e => setDateAnswers(prev => ({ ...prev, [q.id]: { ...dateVal, month: e.target.value } }))}
                    className="flex-1 bg-slate-700/80 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— اختر الشهر —</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {String(i + 1).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dateVal.day}
                    onChange={e => setDateAnswers(prev => ({ ...prev, [q.id]: { ...dateVal, day: e.target.value } }))}
                    className="flex-1 bg-slate-700/80 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— اختر اليوم —</option>
                    {[...Array(31)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {String(i + 1).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          }

          return (
            <div
              key={q.id}
              className={`bg-slate-800/70 border rounded-2xl p-5 transition-colors ${
                hasAnswer ? 'border-emerald-700/50' : hasError ? 'border-red-700/50' : 'border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <label className="text-white text-lg font-medium leading-relaxed flex-1">
                  <span className="text-yellow-400 ml-2">{idx + 1}.</span>
                  {q.text}
                </label>
                {hasAnswer && (
                  <span className="text-emerald-400 text-xs bg-emerald-900/40 px-2 py-1 rounded-full flex-shrink-0">
                    ✓ تمت الإجابة
                  </span>
                )}
              </div>
              <textarea
                value={currentValue}
                onChange={e => {
                  setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))
                  if (validationErrors[q.id]) {
                    setValidationErrors(prev => ({ ...prev, [q.id]: '' }))
                  }
                }}
                placeholder="اكتب إجابتك هنا..."
                rows={2}
                className={`w-full bg-slate-700/80 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 resize-none transition-colors ${
                  hasError
                    ? 'border-red-500/60 focus:ring-red-500'
                    : isModified && currentValue !== q.existing_answer
                      ? 'border-yellow-500/60 focus:ring-yellow-500'
                      : 'border-slate-600 focus:ring-indigo-500'
                }`}
              />
              {hasError && (
                <p className="text-red-400 text-sm mt-2">{hasError}</p>
              )}
            </div>
          )
        })}

        {/* Submit */}
        <div className="fixed bottom-0 right-0 left-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-4">
          <div className="max-w-2xl mx-auto">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg px-4 py-2 text-sm mb-3 text-center">
                {error}
              </div>
            )}
            {saved && (
              <div className="bg-green-500/20 border border-green-500/50 text-green-300 rounded-lg px-4 py-2 text-sm mb-3 text-center">
                ✓ تم حفظ إجاباتك بنجاح
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold text-xl py-4 rounded-xl transition-all"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ الإجابات'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
