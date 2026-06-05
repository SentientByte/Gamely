'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface WildQuestion {
  id: number
  question_text: string
  correct_answer: string
  wrong_answer_1: string
  wrong_answer_2: string
  wrong_answer_3: string
  wrong_answer_4: string
  created_at: string
}

const EMPTY_FORM = {
  question_text: '',
  correct_answer: '',
  wrong_answer_1: '',
  wrong_answer_2: '',
  wrong_answer_3: '',
  wrong_answer_4: '',
}

export default function WildQuestionsPage() {
  const [questions, setQuestions] = useState<WildQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchQuestions()
  }, [])

  async function fetchQuestions() {
    try {
      const res = await fetch('/api/wild-questions', { credentials: 'include' })
      if (res.status === 401) { router.push('/admin'); return }
      const data = await res.json()
      setQuestions(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fields = Object.values(form)
    if (fields.some(v => !v.trim())) {
      alert('يرجى ملء جميع الحقول')
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/wild-questions/${editingId}` : '/api/wild-questions'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setForm(EMPTY_FORM)
        setEditingId(null)
        fetchQuestions()
      } else {
        const data = await res.json()
        alert(data.error || 'حدث خطأ')
      }
    } finally {
      setSaving(false)
    }
  }

  function startEdit(q: WildQuestion) {
    setEditingId(q.id)
    setForm({
      question_text: q.question_text,
      correct_answer: q.correct_answer,
      wrong_answer_1: q.wrong_answer_1,
      wrong_answer_2: q.wrong_answer_2,
      wrong_answer_3: q.wrong_answer_3,
      wrong_answer_4: q.wrong_answer_4,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا السؤال؟')) return
    await fetch(`/api/wild-questions/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchQuestions()
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← رجوع</Link>
          <h1 className="text-2xl font-bold text-white">أسئلة الشخصية الخاصة 👶</h1>
        </div>

        <div className="bg-amber-900/20 border border-amber-600/40 rounded-xl p-4 mb-6 text-amber-300 text-sm">
          هذه الأسئلة مخصصة للشخصية الخاصة. عند استخدام مساعدة الشخصية الخاصة في اللعبة، يتم اختيار سؤال عشوائي من هنا مع خياراته.
        </div>

        {/* Add/Edit Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingId ? '✏️ تعديل السؤال' : '➕ إضافة سؤال جديد'}
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-slate-300 text-sm block mb-1">نص السؤال</label>
              <input
                type="text"
                value={form.question_text}
                onChange={e => setField('question_text', e.target.value)}
                placeholder="مثال: ما هي هواية الشخصية الخاصة؟"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="text-green-400 text-sm block mb-1">✓ الإجابة الصحيحة</label>
              <input
                type="text"
                value={form.correct_answer}
                onChange={e => setField('correct_answer', e.target.value)}
                placeholder="الإجابة الصحيحة"
                className="w-full bg-green-900/20 border border-green-600/40 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-slate-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(n => (
                <div key={n}>
                  <label className="text-red-400 text-sm block mb-1">✗ إجابة خاطئة {n}</label>
                  <input
                    type="text"
                    value={form[`wrong_answer_${n}` as keyof typeof form]}
                    onChange={e => setField(`wrong_answer_${n}`, e.target.value)}
                    placeholder={`إجابة خاطئة ${n}`}
                    className="w-full bg-red-900/20 border border-red-600/40 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors"
            >
              {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة السؤال'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2.5 rounded-lg transition-colors"
              >
                إلغاء
              </button>
            )}
          </div>
        </form>

        {/* Questions list */}
        {loading ? (
          <div className="text-center text-slate-400 py-8">جاري التحميل...</div>
        ) : questions.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            <div className="text-4xl mb-3">👶</div>
            <p>لا توجد أسئلة بعد. أضف أسئلة للشخصية الخاصة أعلاه.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-slate-800 border border-amber-600/30 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold text-sm">#{idx + 1}</span>
                    <p className="text-white font-medium">{q.question_text}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(q)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                      حذف
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div className="bg-green-900/30 border border-green-600/30 rounded-lg px-3 py-1.5 text-green-300">
                    ✓ {q.correct_answer}
                  </div>
                  {[q.wrong_answer_1, q.wrong_answer_2, q.wrong_answer_3, q.wrong_answer_4].map((a, i) => (
                    <div key={i} className="bg-red-900/20 border border-red-600/20 rounded-lg px-3 py-1.5 text-red-300">
                      ✗ {a}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
