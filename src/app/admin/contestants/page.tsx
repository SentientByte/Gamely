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
  A: { label: 'Team A', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30' },
  B: { label: 'Team B', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30' },
  WILD: { label: 'Wild', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' },
}

export default function ContestantsPage() {
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [newName, setNewName] = useState('')
  const [newTeam, setNewTeam] = useState('A')
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
        body: JSON.stringify({ name: newName.trim(), team: newTeam }),
      })
      if (res.ok) {
        setNewName('')
        fetchContestants()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete ${name}? This will also delete all their answers.`)) return
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

  const grouped = {
    A: contestants.filter(c => c.team === 'A'),
    B: contestants.filter(c => c.team === 'B'),
    WILD: contestants.filter(c => c.team === 'WILD'),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← Back</Link>
          <h1 className="text-2xl font-bold text-white">Contestant Manager</h1>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAdd} className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Add New Contestant</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Contestant name"
              className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
            <select
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="A">Team A</option>
              <option value="B">Team B</option>
              <option value="WILD">Wild Character</option>
            </select>
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </form>

        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading...</div>
        ) : (
          <div className="space-y-6">
            {(['A', 'B', 'WILD'] as const).map(team => {
              const t = TEAM_LABELS[team]
              const members = grouped[team]
              return (
                <div key={team} className={`bg-slate-800 border rounded-xl overflow-hidden ${t.bg}`}>
                  <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                    <h2 className={`text-lg font-semibold ${t.color}`}>{t.label}</h2>
                    <span className="text-slate-400 text-sm">{members.length} members</span>
                  </div>

                  {members.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">No members in this team</div>
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
                              {copiedToken === c.token ? '✓ Copied' : 'Copy Link'}
                            </button>
                            <Link
                              href={`/contestant/${c.token}`}
                              target="_blank"
                              className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
                            >
                              Open
                            </Link>
                            <button
                              onClick={() => handleDelete(c.id, c.name)}
                              className="text-sm px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
                            >
                              Delete
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
