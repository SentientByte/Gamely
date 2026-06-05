'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contestant {
  id: number
  name: string
  team: string
  token: string
  created_at: string
}

const TEAM_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  UNASSIGNED: { label: 'غير مُعيَّن', color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/30' },
  A: { label: 'الفريق الأول', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30' },
  B: { label: 'الفريق الثاني', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30' },
  WILD: { label: 'الشخصية الخاصة', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' },
}

export default function ContestantsPage() {
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [newName, setNewName] = useState('')
  const [isWild, setIsWild] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchContestants()
  }, [])

  async function fetchContestants() {
    try {
      const res = await fetch('/api/contestants', { credentials: 'include' })
      if (res.status === 401) { router.push('/admin'); return }
      const data = await res.json()
      setContestants(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/contestants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), team: isWild ? 'WILD' : 'UNASSIGNED' }),
      })
      if (res.ok) {
        setNewName('')
        setIsWild(false)
        fetchContestants()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`حذف ${name}؟ سيتم حذف جميع إجاباته.`)) return
    await fetch(`/api/contestants/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchContestants()
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/contestant/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }

  const grouped: Record<string, Contestant[]> = {
    UNASSIGNED: contestants.filter(c => c.team === 'UNASSIGNED'),
    A: contestants.filter(c => c.team === 'A'),
    B: contestants.filter(c => c.team === 'B'),
    WILD: contestants.filter(c => c.team === 'WILD'),
  }

  const displayOrder = ['UNASSIGNED', 'A', 'B', 'WILD'] as const

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← رجوع</Link>
          <h1 className="text-2xl font-bold text-white">إدارة المتسابقين</h1>
        </div>

        <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-4 mb-4 text-slate-400 text-sm">
          <strong className="text-yellow-400">ملاحظة:</strong> يتم تعيين الفرق عند بدء اللعبة من صفحة التحكم. أضف المتسابقين هنا، وحدد الشخصية الخاصة إذا لزم الأمر.
        </div>

        {/* Add Form */}
        <form onSubmit={handleAdd} className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">إضافة متسابق جديد</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="اسم المتسابق"
              className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
            <label className="flex items-center gap-2 cursor-pointer bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-amber-400 hover:border-amber-500 transition-colors">
              <input
                type="checkbox"
                checked={isWild}
                onChange={e => setIsWild(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm whitespace-nowrap">شخصية خاصة 👶</span>
            </label>
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              إضافة
            </button>
          </div>
        </form>

        {loading ? (
          <div className="text-center text-slate-400 py-8">جاري التحميل...</div>
        ) : (
          <div className="space-y-6">
            {displayOrder.map(team => {
              const t = TEAM_LABELS[team]
              const members = grouped[team]
              if (members.length === 0 && team !== 'UNASSIGNED') return null
              return (
                <div key={team} className={`bg-slate-800 border rounded-xl overflow-hidden ${t.bg}`}>
                  <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                    <h2 className={`text-lg font-semibold ${t.color}`}>{t.label}</h2>
                    <span className="text-slate-400 text-sm">{members.length} متسابق</span>
                  </div>

                  {members.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">
                      {team === 'UNASSIGNED' ? 'لا يوجد متسابقون بعد' : 'لا يوجد أعضاء'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700">
                      {members.map(c => (
                        <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                          <div className="flex-1">
                            <p className="text-white font-medium">{c.name}</p>
                            <p className="text-slate-500 text-xs mt-0.5 font-mono truncate max-w-xs">
                              /contestant/{c.token.substring(0, 8)}...
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyLink(c.token)}
                              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                                copiedToken === c.token
                                  ? 'bg-green-600 border-green-500 text-white'
                                  : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white'
                              }`}
                            >
                              {copiedToken === c.token ? '✓ تم النسخ' : 'نسخ الرابط'}
                            </button>
                            <Link
                              href={`/contestant/${c.token}`}
                              target="_blank"
                              className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
                            >
                              فتح
                            </Link>
                            <button
                              onClick={() => handleDelete(c.id, c.name)}
                              className="text-sm px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
