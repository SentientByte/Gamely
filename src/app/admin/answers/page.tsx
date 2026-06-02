'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question { id: number; text: string }
interface Contestant { id: number; name: string; team: string }
interface Answer { id: number; contestant_id: number; question_id: number; answer: string }

export default function AnswersPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [filterContestant, setFilterContestant] = useState<string>('all')
  const [filterQuestion, setFilterQuestion] = useState<string>('all')
  const [editingCell, setEditingCell] = useState<{ contestant_id: number; question_id: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [qRes, cRes, aRes] = await Promise.all([
        fetch('/api/questions'),
        fetch('/api/contestants'),
        fetch('/api/answers'),
      ])
      if (qRes.status === 401) { router.push('/admin'); return }

      setQuestions(qRes.ok ? await qRes.json() : [])
      setContestants(cRes.ok ? await cRes.json() : [])
      setAnswers(aRes.ok ? await aRes.json() : [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  function getAnswer(contestant_id: number, question_id: number): Answer | undefined {
    return answers.find(a => a.contestant_id === contestant_id && a.question_id === question_id)
  }

  async function handleSaveEdit(contestant_id: number, question_id: number) {
    if (!editValue.trim()) {
      // Delete
      const ans = getAnswer(contestant_id, question_id)
      if (ans) {
        await fetch(`/api/answers/${ans.id}`, { method: 'DELETE' })
      }
    } else {
      const ans = getAnswer(contestant_id, question_id)
      if (ans) {
        await fetch(`/api/answers/${ans.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: editValue }),
        })
      } else {
        await fetch('/api/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contestant_id, question_id, answer: editValue }),
        })
      }
    }
    setEditingCell(null)
    fetchData()
  }

  const filteredContestants = filterContestant === 'all'
    ? contestants
    : contestants.filter(c => c.id.toString() === filterContestant)

  const filteredQuestions = filterQuestion === 'all'
    ? questions
    : questions.filter(q => q.id.toString() === filterQuestion)

  const teamColors: Record<string, string> = {
    A: 'text-green-400',
    B: 'text-blue-400',
    WILD: 'text-amber-400',
  }

  const answered = answers.length
  const total = contestants.length * questions.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-full mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← Back</Link>
          <h1 className="text-2xl font-bold text-white">Answers Manager</h1>
          <span className="text-slate-400 text-sm ml-auto">
            {answered}/{total} answers submitted
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-5">
          <select
            value={filterContestant}
            onChange={e => setFilterContestant(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Contestants</option>
            {contestants.map(c => (
              <option key={c.id} value={c.id.toString()}>{c.name} ({c.team})</option>
            ))}
          </select>
          <select
            value={filterQuestion}
            onChange={e => setFilterQuestion(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Questions</option>
            {questions.map(q => (
              <option key={q.id} value={q.id.toString()}>Q{q.id}: {q.text.substring(0, 40)}...</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading...</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800">
                  <th className="text-left p-3 text-slate-400 font-medium sticky left-0 bg-slate-800 border-r border-slate-700 min-w-32">
                    Contestant
                  </th>
                  {filteredQuestions.map(q => (
                    <th key={q.id} className="p-3 text-center text-slate-400 font-medium min-w-36 border-r border-slate-700 last:border-r-0">
                      <div className="text-xs" dir="rtl">{q.text.length > 30 ? q.text.substring(0, 30) + '...' : q.text}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredContestants.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/50">
                    <td className="p-3 sticky left-0 bg-slate-900 border-r border-slate-700">
                      <div className={`font-medium ${teamColors[c.team] || 'text-white'}`}>{c.name}</div>
                      <div className="text-xs text-slate-500">{c.team}</div>
                    </td>
                    {filteredQuestions.map(q => {
                      const ans = getAnswer(c.id, q.id)
                      const isEditing = editingCell?.contestant_id === c.id && editingCell?.question_id === q.id
                      return (
                        <td key={q.id} className="p-2 border-r border-slate-700 last:border-r-0 align-top">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <textarea
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-12 resize-none"
                                dir="rtl"
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleSaveEdit(c.id, q.id)}
                                  className="flex-1 bg-green-700 text-white text-xs rounded px-2 py-0.5"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingCell(null)}
                                  className="flex-1 bg-slate-600 text-white text-xs rounded px-2 py-0.5"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCell({ contestant_id: c.id, question_id: q.id })
                                setEditValue(ans?.answer || '')
                              }}
                              className="w-full text-left text-xs rounded p-1.5 hover:bg-slate-700 transition-colors"
                            >
                              {ans ? (
                                <span className="text-emerald-300" dir="rtl">{ans.answer}</span>
                              ) : (
                                <span className="text-slate-600 italic">Not answered</span>
                              )}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
