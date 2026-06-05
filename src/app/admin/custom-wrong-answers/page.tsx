'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contestant { id: number; name: string; team: string }
interface Question { id: number; text: string }
interface WrongAnswer { id: number; contestant_id: number; question_id: number; wrong_answer: string; contestant_name?: string; question_text?: string }

export default function CustomWrongAnswersPage() {
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([])
  const [selContestant, setSelContestant] = useState('')
  const [selQuestion, setSelQuestion] = useState('')
  const [newWrong, setNewWrong] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterC, setFilterC] = useState('all')
  const [filterQ, setFilterQ] = useState('all')
  const router = useRouter()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    try {
      const [cRes, qRes, wRes] = await Promise.all([
        fetch('/api/contestants', { credentials: 'include' }),
        fetch('/api/questions', { credentials: 'include' }),
        fetch('/api/custom-wrong-answers', { credentials: 'include' }),
      ])
      if (cRes.status === 401) { router.push('/admin'); return }
      setContestants(cRes.ok ? await cRes.json() : [])
      setQuestions(qRes.ok ? await qRes.json() : [])
      setWrongAnswers(wRes.ok ? await wRes.json() : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selContestant || !selQuestion || !newWrong.trim()) return
    const res = await fetch('/api/custom-wrong-answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ contestant_id: parseInt(selContestant), question_id: parseInt(selQuestion), wrong_answer: newWrong.trim() }),
    })
    if (res.ok) { setNewWrong(''); await fetchAll() }
    else { const d = await res.json(); alert(d.error || 'حدث خطأ') }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/custom-wrong-answers/${id}`, { method: 'DELETE', credentials: 'include' })
    await fetchAll()
  }

  const filtered = wrongAnswers.filter(w =>
    (filterC === 'all' || w.contestant_id.toString() === filterC) &&
    (filterQ === 'all' || w.question_id.toString() === filterQ)
  )

  const teamColors: Record<string, string> = { A: 'text-green-400', B: 'text-blue-400', WILD: 'text-amber-400' }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← رجوع</Link>
          <h1 className="text-2xl font-bold text-white">إجابات خاطئة مخصصة ✗</h1>
        </div>

        <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4 mb-5 text-slate-400 text-sm">
          <strong className="text-yellow-400">ملاحظة:</strong> حدد إجابات خاطئة مخصصة لكل متسابق/سؤال. إذا كانت هناك إجابات مخصصة، ستُستخدم أولاً في اللعبة بدلاً من إجابات المتسابقين الآخرين.
        </div>

        {/* Add Form */}
        <form onSubmit={handleAdd} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-6 space-y-3">
          <h2 className="text-yellow-400 font-bold text-lg">إضافة إجابة خاطئة</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-300 text-sm block mb-1">المتسابق</label>
              <select value={selContestant} onChange={e => setSelContestant(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500" required>
                <option value="">— اختر —</option>
                {contestants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-300 text-sm block mb-1">السؤال</label>
              <select value={selQuestion} onChange={e => setSelQuestion(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500" required>
                <option value="">— اختر —</option>
                {questions.map(q => <option key={q.id} value={q.id}>س{q.id}: {q.text.substring(0, 35)}...</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-300 text-sm block mb-1">الإجابة الخاطئة</label>
              <input value={newWrong} onChange={e => setNewWrong(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500" required />
            </div>
          </div>
          <button type="submit" className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg transition-colors">إضافة</button>
        </form>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select value={filterC} onChange={e => setFilterC(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="all">جميع المتسابقين</option>
            {contestants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterQ} onChange={e => setFilterQ(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="all">جميع الأسئلة</option>
            {questions.map(q => <option key={q.id} value={q.id}>س{q.id}: {q.text.substring(0, 30)}...</option>)}
          </select>
          <span className="text-slate-400 text-sm self-center">{filtered.length} إجابة</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-slate-400 py-8">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-8">لا توجد إجابات خاطئة مخصصة بعد</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-right p-3 text-slate-400 font-medium">المتسابق</th>
                  <th className="text-right p-3 text-slate-400 font-medium">السؤال</th>
                  <th className="text-right p-3 text-slate-400 font-medium">الإجابة الخاطئة</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.map(w => {
                  const c = contestants.find(c => c.id === w.contestant_id)
                  const q = questions.find(q => q.id === w.question_id)
                  return (
                    <tr key={w.id} className="hover:bg-slate-800/50">
                      <td className="p-3">
                        <span className={`font-medium ${teamColors[c?.team || ''] || 'text-white'}`}>{w.contestant_name || c?.name}</span>
                      </td>
                      <td className="p-3 text-slate-300 text-xs max-w-48">{w.question_text || q?.text}</td>
                      <td className="p-3 text-red-300">{w.wrong_answer}</td>
                      <td className="p-3">
                        <button onClick={() => handleDelete(w.id)} className="text-red-400 hover:text-red-300 text-xs">حذف</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
