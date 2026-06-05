'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contestant { id: number; name: string; team: string }
interface CustomQuestion {
  id: number; contestant_id: number; contestant_name?: string
  question_text: string; correct_answer: string
  wrong_answer_1: string; wrong_answer_2: string; wrong_answer_3: string; wrong_answer_4: string
}

const EMPTY_FORM = { contestant_id: '', question_text: '', correct_answer: '', wrong_answer_1: '', wrong_answer_2: '', wrong_answer_3: '', wrong_answer_4: '' }

export default function CustomQuestionsPage() {
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [questions, setQuestions] = useState<CustomQuestion[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterContestant, setFilterContestant] = useState('all')
  const router = useRouter()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    try {
      const [cRes, qRes] = await Promise.all([
        fetch('/api/contestants', { credentials: 'include' }),
        fetch('/api/custom-questions', { credentials: 'include' }),
      ])
      if (cRes.status === 401) { router.push('/admin'); return }
      setContestants(cRes.ok ? await cRes.json() : [])
      setQuestions(qRes.ok ? await qRes.json() : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contestant_id) { alert('اختر متسابقاً'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/custom-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, contestant_id: parseInt(form.contestant_id) }),
      })
      if (res.ok) {
        setForm(EMPTY_FORM)
        await fetchAll()
      } else {
        const d = await res.json()
        alert(d.error || 'حدث خطأ')
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا السؤال؟')) return
    await fetch(`/api/custom-questions/${id}`, { method: 'DELETE', credentials: 'include' })
    await fetchAll()
  }

  const filtered = filterContestant === 'all' ? questions : questions.filter(q => q.contestant_id.toString() === filterContestant)
  const teamColors: Record<string, string> = { A: 'text-green-400', B: 'text-blue-400', WILD: 'text-amber-400' }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← رجوع</Link>
          <h1 className="text-2xl font-bold text-white">أسئلة مخصصة للمتسابقين 🎯</h1>
        </div>

        {/* Add Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-6 space-y-4">
          <h2 className="text-yellow-400 font-bold text-lg">إضافة سؤال مخصص</h2>

          <div>
            <label className="text-slate-300 text-sm block mb-1">المتسابق</label>
            <select
              value={form.contestant_id}
              onChange={e => setForm(f => ({ ...f, contestant_id: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            >
              <option value="">— اختر متسابقاً —</option>
              {contestants.filter(c => c.team !== 'WILD').map(c => (
                <option key={c.id} value={c.id}>{c.name} (فريق {c.team})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-300 text-sm block mb-1">نص السؤال</label>
            <textarea
              value={form.question_text}
              onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 min-h-16 resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-emerald-400 text-sm block mb-1">✓ الإجابة الصحيحة</label>
              <input value={form.correct_answer} onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))} className="w-full bg-slate-700 border border-emerald-600/50 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
            </div>
            {(['wrong_answer_1', 'wrong_answer_2', 'wrong_answer_3', 'wrong_answer_4'] as const).map((k, i) => (
              <div key={k}>
                <label className="text-red-400 text-sm block mb-1">✗ إجابة خاطئة {i + 1}</label>
                <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full bg-slate-700 border border-red-600/40 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" required />
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving} className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-lg transition-colors">
            {saving ? 'جاري الحفظ...' : 'إضافة السؤال'}
          </button>
        </form>

        {/* Filter */}
        <div className="flex gap-3 mb-4">
          <select value={filterContestant} onChange={e => setFilterContestant(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">جميع المتسابقين</option>
            {contestants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-slate-400 text-sm self-center">{filtered.length} سؤال</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-slate-400 py-8">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-8">لا توجد أسئلة مخصصة بعد</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(q => {
              const c = contestants.find(c => c.id === q.contestant_id)
              return (
                <div key={q.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className={`text-sm font-medium ${teamColors[c?.team || ''] || 'text-white'}`}>{q.contestant_name || c?.name}</span>
                      <p className="text-white font-medium mt-1">{q.question_text}</p>
                    </div>
                    <button onClick={() => handleDelete(q.id)} className="text-red-400 hover:text-red-300 text-sm shrink-0">حذف</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                    <div className="bg-emerald-900/30 border border-emerald-600/40 rounded-lg px-2 py-1 text-xs text-emerald-300">✓ {q.correct_answer}</div>
                    {[q.wrong_answer_1, q.wrong_answer_2, q.wrong_answer_3, q.wrong_answer_4].map((w, i) => (
                      <div key={i} className="bg-red-900/20 border border-red-600/30 rounded-lg px-2 py-1 text-xs text-red-300">✗ {w}</div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
