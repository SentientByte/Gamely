'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contestant { id: number; name: string; team: string }
interface CustomQuestion {
  id: number; contestant_id: number; contestant_name?: string
  question_text: string; correct_answer: string
  wrong_answer_1: string; wrong_answer_2: string; wrong_answer_3: string; wrong_answer_4: string
  min_wager: number; max_wager: number
}
interface Question { id: number; text: string }
interface Answer { id: number; contestant_id: number; question_id: number; answer: string }
interface WrongAnswer { id: number; contestant_id: number; question_id: number; wrong_answer: string }
interface EditingCorrect { contestant_id: number; question_id: number; answer_id: number | null; value: string }
interface AddingWrong { question_id: number; contestant_id: number; value: string }

const EMPTY_FORM = { contestant_id: '', question_text: '', correct_answer: '', wrong_answer_1: '', wrong_answer_2: '', wrong_answer_3: '', wrong_answer_4: '', min_wager: '0', max_wager: '1000' }
const WAGER_OPTIONS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
const teamColors: Record<string, string> = { A: 'text-green-400', B: 'text-blue-400', WILD: 'text-amber-400' }

export default function CombinedQuestionsPage() {
  const [activeTab, setActiveTab] = useState<'custom' | 'answers'>('custom')
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterContestant, setFilterContestant] = useState('all')
  const [filterQuestion, setFilterQuestion] = useState('')
  const [editingCorrect, setEditingCorrect] = useState<EditingCorrect | null>(null)
  const [addingWrong, setAddingWrong] = useState<AddingWrong | null>(null)
  const router = useRouter()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    try {
      const [cRes, cqRes, qRes, aRes, wRes] = await Promise.all([
        fetch('/api/contestants', { credentials: 'include' }),
        fetch('/api/custom-questions', { credentials: 'include' }),
        fetch('/api/questions', { credentials: 'include' }),
        fetch('/api/answers', { credentials: 'include' }),
        fetch('/api/custom-wrong-answers', { credentials: 'include' }),
      ])
      if (cRes.status === 401) { router.push('/admin'); return }
      setContestants(cRes.ok ? await cRes.json() : [])
      setCustomQuestions(cqRes.ok ? await cqRes.json() : [])
      setQuestions(qRes.ok ? await qRes.json() : [])
      setAnswers(aRes.ok ? await aRes.json() : [])
      setWrongAnswers(wRes.ok ? await wRes.json() : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  // ---- Custom Questions tab ----
  async function handleSubmitCustom(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contestant_id) { alert('اختر متسابقاً'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/custom-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          contestant_id: parseInt(form.contestant_id),
          min_wager: parseInt(form.min_wager) || 0,
          max_wager: parseInt(form.max_wager) || 1000,
        }),
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

  async function handleDeleteCustom(id: number) {
    if (!confirm('حذف هذا السؤال؟')) return
    await fetch(`/api/custom-questions/${id}`, { method: 'DELETE', credentials: 'include' })
    await fetchAll()
  }

  // ---- Answers Manager tab ----
  async function handleDeleteQuestion(id: number) {
    if (!confirm('حذف هذا السؤال من المجموعة نهائياً؟')) return
    await fetch(`/api/questions/${id}`, { method: 'DELETE', credentials: 'include' })
    await fetchAll()
  }

  async function handleSaveCorrect(ec: EditingCorrect) {
    if (!ec.value.trim()) {
      if (ec.answer_id) await fetch(`/api/answers/${ec.answer_id}`, { method: 'DELETE', credentials: 'include' })
    } else if (ec.answer_id) {
      await fetch(`/api/answers/${ec.answer_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ answer: ec.value }) })
    } else {
      await fetch('/api/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ contestant_id: ec.contestant_id, question_id: ec.question_id, answer: ec.value }) })
    }
    setEditingCorrect(null)
    await fetchAll()
  }

  async function handleDeleteWrong(id: number) {
    await fetch(`/api/custom-wrong-answers/${id}`, { method: 'DELETE', credentials: 'include' })
    await fetchAll()
  }

  async function handleAddWrong(aw: AddingWrong) {
    if (!aw.value.trim() || !aw.contestant_id) { setAddingWrong(null); return }
    await fetch('/api/custom-wrong-answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ contestant_id: aw.contestant_id, question_id: aw.question_id, wrong_answer: aw.value }) })
    setAddingWrong(null)
    await fetchAll()
  }

  const visibleContestants = contestants.filter(c => c.team !== 'WILD')
  const filteredCustom = filterContestant === 'all' ? customQuestions : customQuestions.filter(q => q.contestant_id.toString() === filterContestant)
  const filteredQuestions = questions.filter(q => {
    if (filterQuestion && !q.text.includes(filterQuestion)) return false
    if (filterContestant !== 'all') {
      const cId = parseInt(filterContestant)
      const hasAnswer = answers.some(a => a.contestant_id === cId && a.question_id === q.id)
      const hasWrong = wrongAnswers.some(w => w.contestant_id === cId && w.question_id === q.id)
      if (!hasAnswer && !hasWrong) return false
    }
    return true
  })
  const displayContestants = filterContestant === 'all' ? visibleContestants : visibleContestants.filter(c => c.id.toString() === filterContestant)

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← رجوع</Link>
          <h1 className="text-2xl font-bold text-white">إدارة الأسئلة والإجابات</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-800/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'custom' ? 'bg-yellow-500 text-black' : 'text-slate-400 hover:text-white'}`}
          >
            🎯 أسئلة مخصصة للمتسابقين
          </button>
          <button
            onClick={() => setActiveTab('answers')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'answers' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'}`}
          >
            📝 مدير الإجابات
          </button>
        </div>

        {/* ===== CUSTOM QUESTIONS TAB ===== */}
        {activeTab === 'custom' && (
          <div>
            <form onSubmit={handleSubmitCustom} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-6 space-y-4">
              <h2 className="text-yellow-400 font-bold text-lg">إضافة سؤال مخصص</h2>

              <div>
                <label className="text-slate-300 text-sm block mb-1">المتسابق</label>
                <select value={form.contestant_id} onChange={e => setForm(f => ({ ...f, contestant_id: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500" required>
                  <option value="">— اختر متسابقاً —</option>
                  {contestants.filter(c => c.team !== 'WILD').map(c => (
                    <option key={c.id} value={c.id}>{c.name} (فريق {c.team})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 text-sm block mb-1">نص السؤال</label>
                <textarea value={form.question_text} onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 min-h-16 resize-none" required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-emerald-400 text-sm block mb-1">✓ الإجابة الصحيحة</label>
                  <input value={form.correct_answer} onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))}
                    className="w-full bg-slate-700 border border-emerald-600/50 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                </div>
                {(['wrong_answer_1', 'wrong_answer_2', 'wrong_answer_3', 'wrong_answer_4'] as const).map((k, i) => (
                  <div key={k}>
                    <label className="text-red-400 text-sm block mb-1">✗ إجابة خاطئة {i + 1}</label>
                    <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                      className="w-full bg-slate-700 border border-red-600/40 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" required />
                  </div>
                ))}
              </div>

              {/* Wager Range */}
              <div className="bg-slate-700/40 border border-slate-600/50 rounded-xl p-4">
                <div className="text-orange-400 text-sm font-medium mb-3">🎯 نطاق المراهنة (متى يظهر السؤال؟)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 text-xs block mb-1">الحد الأدنى للمراهنة</label>
                    <select value={form.min_wager} onChange={e => setForm(f => ({ ...f, min_wager: e.target.value }))}
                      className="w-full bg-slate-600 border border-slate-500 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {WAGER_OPTIONS.map(w => <option key={w} value={w}>{w === 0 ? 'بدون حد أدنى (0)' : `${w} نقطة`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-300 text-xs block mb-1">الحد الأقصى للمراهنة</label>
                    <select value={form.max_wager} onChange={e => setForm(f => ({ ...f, max_wager: e.target.value }))}
                      className="w-full bg-slate-600 border border-slate-500 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {WAGER_OPTIONS.filter(w => w > 0).map(w => <option key={w} value={w}>{w === 1000 ? 'بدون حد أقصى (1000)' : `${w} نقطة`}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-2">
                  السؤال سيظهر فقط عندما تكون المراهنة بين {form.min_wager} و {form.max_wager} نقطة
                </p>
              </div>

              <button type="submit" disabled={saving}
                className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-lg transition-colors">
                {saving ? 'جاري الحفظ...' : 'إضافة السؤال'}
              </button>
            </form>

            {/* Filter + List */}
            <div className="flex gap-3 mb-4">
              <select value={filterContestant} onChange={e => setFilterContestant(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="all">جميع المتسابقين</option>
                {contestants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="text-slate-400 text-sm self-center">{filteredCustom.length} سؤال</span>
            </div>

            {loading ? (
              <div className="text-center text-slate-400 py-8">جاري التحميل...</div>
            ) : filteredCustom.length === 0 ? (
              <div className="text-center text-slate-500 py-8">لا توجد أسئلة مخصصة بعد</div>
            ) : (
              <div className="space-y-3">
                {filteredCustom.map(q => {
                  const c = contestants.find(c => c.id === q.contestant_id)
                  const minW = q.min_wager ?? 0
                  const maxW = q.max_wager ?? 1000
                  return (
                    <div key={q.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${teamColors[c?.team || ''] || 'text-white'}`}>{q.contestant_name || c?.name}</span>
                            <span className="text-xs bg-orange-900/40 border border-orange-700/50 text-orange-300 rounded-full px-2 py-0.5">
                              🎯 {minW}–{maxW} نقطة
                            </span>
                          </div>
                          <p className="text-white font-medium">{q.question_text}</p>
                        </div>
                        <button onClick={() => handleDeleteCustom(q.id)} className="text-red-400 hover:text-red-300 text-sm shrink-0">حذف</button>
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
        )}

        {/* ===== ANSWERS MANAGER TAB ===== */}
        {activeTab === 'answers' && (
          <div>
            <div className="flex gap-3 mb-5 flex-wrap">
              <select value={filterContestant} onChange={e => setFilterContestant(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="all">جميع الشخصيات</option>
                {contestants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input value={filterQuestion} onChange={e => setFilterQuestion(e.target.value)}
                placeholder="بحث في نص السؤال..."
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none flex-1 min-w-48" />
              <span className="text-slate-400 text-sm self-center">{filteredQuestions.length} سؤال</span>
            </div>

            {loading ? (
              <div className="text-center text-slate-400 py-8">جاري التحميل...</div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center text-slate-500 py-8">لا توجد أسئلة مطابقة</div>
            ) : (
              <div className="space-y-4">
                {filteredQuestions.map(q => {
                  const qAnswers = answers.filter(a => a.question_id === q.id)
                  const qWrongs = wrongAnswers.filter(w => w.question_id === q.id)
                  return (
                    <div key={q.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1">
                          <span className="text-slate-500 text-xs ml-2">#{q.id}</span>
                          <span className="text-white font-medium text-lg">{q.text}</span>
                        </div>
                        <button onClick={() => handleDeleteQuestion(q.id)}
                          className="text-red-500 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-red-900/30 border border-red-800/40 transition-colors flex-shrink-0">
                          حذف السؤال
                        </button>
                      </div>

                      <div className="mb-4">
                        <div className="text-xs text-emerald-500 uppercase tracking-wide font-medium mb-2">الإجابات الصحيحة</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {displayContestants.map(c => {
                            const ans = qAnswers.find(a => a.contestant_id === c.id)
                            const isEditing = editingCorrect?.contestant_id === c.id && editingCorrect?.question_id === q.id
                            return (
                              <div key={c.id} className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
                                <span className={`text-xs font-semibold min-w-20 truncate ${teamColors[c.team] || 'text-white'}`}>{c.name}</span>
                                {isEditing ? (
                                  <div className="flex gap-1 flex-1">
                                    <input autoFocus value={editingCorrect!.value}
                                      onChange={e => setEditingCorrect(prev => prev ? { ...prev, value: e.target.value } : null)}
                                      onKeyDown={e => { if (e.key === 'Enter') handleSaveCorrect(editingCorrect!); if (e.key === 'Escape') setEditingCorrect(null) }}
                                      className="flex-1 bg-slate-600 border border-emerald-500/50 text-white rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-0" />
                                    <button onClick={() => handleSaveCorrect(editingCorrect!)}
                                      className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded px-2 py-0.5 flex-shrink-0">حفظ</button>
                                    <button onClick={() => setEditingCorrect(null)}
                                      className="text-xs bg-slate-600 text-slate-300 rounded px-2 py-0.5 flex-shrink-0">إلغاء</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setEditingCorrect({ contestant_id: c.id, question_id: q.id, answer_id: ans?.id ?? null, value: ans?.answer || '' })}
                                    className="flex-1 text-right text-sm rounded px-2 py-0.5 hover:bg-slate-600 transition-colors truncate">
                                    {ans
                                      ? <span className="text-emerald-300">{ans.answer}</span>
                                      : <span className="text-slate-600 italic text-xs">— انقر للإضافة —</span>}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-red-400 uppercase tracking-wide font-medium mb-2">الإجابات الخاطئة المخصصة</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {qWrongs
                            .filter(w => filterContestant === 'all' || w.contestant_id.toString() === filterContestant)
                            .map(w => {
                              const c = contestants.find(c => c.id === w.contestant_id)
                              return (
                                <div key={w.id} className="flex items-center gap-1.5 bg-red-900/30 border border-red-800/50 rounded-lg px-2.5 py-1.5">
                                  {c && <span className={`text-xs font-medium ${teamColors[c.team] || 'text-white'}`}>{c.name}:</span>}
                                  <span className="text-red-300 text-sm">{w.wrong_answer}</span>
                                  <button onClick={() => handleDeleteWrong(w.id)}
                                    className="text-red-600 hover:text-red-400 text-xs mr-0.5 leading-none">✕</button>
                                </div>
                              )
                            })}
                          {addingWrong?.question_id === q.id && (
                            <div className="flex gap-1.5 items-center bg-slate-700/60 border border-slate-600 rounded-lg px-2 py-1">
                              <select value={addingWrong.contestant_id || ''}
                                onChange={e => setAddingWrong(prev => prev ? { ...prev, contestant_id: parseInt(e.target.value) } : null)}
                                className="bg-slate-600 border border-slate-500 text-white rounded px-2 py-0.5 text-xs focus:outline-none">
                                <option value="">الشخصية</option>
                                {contestants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <input autoFocus value={addingWrong.value}
                                onChange={e => setAddingWrong(prev => prev ? { ...prev, value: e.target.value } : null)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddWrong(addingWrong); if (e.key === 'Escape') setAddingWrong(null) }}
                                placeholder="الإجابة الخاطئة..."
                                className="bg-slate-600 border border-slate-500 text-white rounded px-2 py-0.5 text-xs focus:outline-none w-36" />
                              <button onClick={() => handleAddWrong(addingWrong)}
                                className="text-xs bg-yellow-600 hover:bg-yellow-500 text-black font-medium rounded px-2 py-0.5">إضافة</button>
                              <button onClick={() => setAddingWrong(null)}
                                className="text-xs bg-slate-500 text-slate-200 rounded px-2 py-0.5">إلغاء</button>
                            </div>
                          )}
                        </div>
                        {addingWrong?.question_id !== q.id && (
                          <button onClick={() => setAddingWrong({ question_id: q.id, contestant_id: 0, value: '' })}
                            className="text-xs text-yellow-500 hover:text-yellow-400 border border-yellow-800/50 rounded-lg px-3 py-1.5 hover:bg-yellow-900/20 transition-colors">
                            + إضافة إجابة خاطئة
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
