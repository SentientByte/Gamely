'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question {
  id: number
  text: string
  created_at: string
}

interface AnswerCount {
  question_id: number
  count: number
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answerCounts, setAnswerCounts] = useState<Map<number, number>>(new Map())
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [qRes, aRes] = await Promise.all([
        fetch('/api/questions'),
        fetch('/api/answers'),
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
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText.trim() }),
      })
      if (res.ok) {
        setNewText('')
        fetchData()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id: number) {
    if (!editText.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim() }),
      })
      if (res.ok) {
        setEditingId(null)
        fetchData()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this question? This will also delete all related answers.')) return
    await fetch(`/api/questions/${id}`, { method: 'DELETE' })
    fetchData()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← Back</Link>
          <h1 className="text-2xl font-bold text-white">Question Manager</h1>
        </div>

        {/* Add New Question */}
        <form onSubmit={handleAdd} className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Add New Question</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Enter question text in Arabic..."
              className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-500"
              dir="rtl"
            />
            <button
              type="submit"
              disabled={saving || !newText.trim()}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </form>

        {/* Questions List */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">All Questions ({questions.length})</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No questions yet</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-4">
                  {editingId === q.id ? (
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        dir="rtl"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEdit(q.id)}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <span className="text-slate-500 text-sm font-mono mt-0.5 w-6 flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-white text-sm" dir="rtl">{q.text}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {answerCounts.get(q.id) || 0} answers submitted
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingId(q.id); setEditText(q.text) }}
                          className="text-blue-400 hover:text-blue-300 text-sm px-3 py-1 rounded-lg hover:bg-blue-500/10 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          Delete
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
