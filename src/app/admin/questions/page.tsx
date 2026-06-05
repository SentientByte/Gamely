'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question {
  id: number
  text: string
  personalized_template: string | null
  reverse_template: string | null
  created_at: string
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answerCounts, setAnswerCounts] = useState<Map<number, number>>(new Map())
  const [newText, setNewText] = useState('')
  const [newTemplate, setNewTemplate] = useState('')
  const [newReverse, setNewReverse] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editTemplate, setEditTemplate] = useState('')
  const [editReverse, setEditReverse] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [qRes, aRes] = await Promise.all([
        fetch('/api/questions', { credentials: 'include' }),
        fetch('/api/answers', { credentials: 'include' }),
      ])
      if (qRes.status === 401) { router.push('/admin'); return }
      const qs: Question[] = qRes.ok ? await qRes.json() : []
      const answers: Array<{ question_id: number }> = aRes.ok ? await aRes.json() : []
      setQuestions(qs)
      const counts = new Map<number, number>()
      for (const a of answers) {
        counts.set(a.question_id, (counts.get(a.question_id) || 0) + 1)
      }
      setAnswerCounts(counts)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: newText.trim(), personalized_template: newTemplate.trim() || null, reverse_template: newReverse.trim() || null }),
      })
      if (res.ok) {
        setNewText('')
        setNewTemplate('')
        setNewReverse('')
        fetchData()
      }
    } finally {
      setSaving(false) }
  }

  async function handleEdit(id: number) {
    if (!editText.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: editText.trim(), personalized_template: editTemplate.trim() || null, reverse_template: editReverse.trim() || null }),
      })
      if (res.ok) { setEditingId(null); fetchData() }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا السؤال؟ سيتم حذف جميع الإجابات المرتبطة.')) return
    await fetch(`/api/questions/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchData()
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← رجوع</Link>
          <h1 className="text-2xl font-bold text-white">إدارة الأسئلة</h1>
        </div>

        <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4 mb-4 text-slate-400 text-sm space-y-1">
          <div>استخدم <code className="text-yellow-400">{'{name}'}</code> في نموذج التخصيص ليتم استبداله باسم المتسابق.</div>
          <div>استخدم <code className="text-orange-400">{'{answer}'}</code> في سؤال المراهنة العالية (أكثر من 500) ليتم استبداله بإجابة المتسابق. مثال: <span className="text-slate-300">"من وُلد في {'{answer}'}؟"</span></div>
        </div>

        <form onSubmit={handleAdd} className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">إضافة سؤال جديد</h2>
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="نص السؤال (الصيغة العامة)..."
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-500"
            />
            <input
              type="text"
              value={newTemplate}
              onChange={e => setNewTemplate(e.target.value)}
              placeholder={`نموذج التخصيص باستخدام {name} — مثال: ما هي الوجبة المفضلة لـ{'{name}'}؟`}
              className="w-full bg-slate-700 border border-violet-600/40 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-500 text-sm"
            />
            <input
              type="text"
              value={newReverse}
              onChange={e => setNewReverse(e.target.value)}
              placeholder={`سؤال المراهنة العالية (أكثر من 500) باستخدام {answer} — مثال: من وُلد في {'{answer}'}؟`}
              className="w-full bg-slate-700 border border-orange-600/40 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newText.trim()}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            إضافة
          </button>
        </form>

        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">جميع الأسئلة ({questions.length})</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">جاري التحميل...</div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">لا توجد أسئلة بعد</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-4">
                  {editingId === q.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editTemplate}
                        onChange={e => setEditTemplate(e.target.value)}
                        placeholder={`نموذج مخصص باستخدام {name}`}
                        className="w-full bg-slate-700 border border-violet-600/40 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-500"
                      />
                      <input
                        type="text"
                        value={editReverse}
                        onChange={e => setEditReverse(e.target.value)}
                        placeholder={`سؤال >500 باستخدام {answer}`}
                        className="w-full bg-slate-700 border border-orange-600/40 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm placeholder-slate-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(q.id)} disabled={saving}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                          حفظ
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <span className="text-slate-500 text-sm font-mono mt-0.5 w-6 flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-white text-sm">{q.text}</p>
                        {q.personalized_template && (
                          <p className="text-violet-400 text-xs mt-1">📝 {q.personalized_template}</p>
                        )}
                        {q.reverse_template && (
                          <p className="text-orange-400 text-xs mt-1">🔄 &gt;500: {q.reverse_template}</p>
                        )}
                        <p className="text-slate-500 text-xs mt-1">
                          {answerCounts.get(q.id) || 0} إجابة
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingId(q.id); setEditText(q.text); setEditTemplate(q.personalized_template || ''); setEditReverse(q.reverse_template || '') }}
                          className="text-blue-400 hover:text-blue-300 text-sm px-3 py-1 rounded-lg hover:bg-blue-500/10 transition-colors"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
