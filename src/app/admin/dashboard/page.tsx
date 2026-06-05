'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Stats {
  questions: number
  teamA: number
  teamB: number
  wild: number
  answers: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ questions: 0, teamA: 0, teamB: 0, wild: 0, answers: 0 })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const [qRes, cRes, aRes] = await Promise.all([
        fetch('/api/questions', { credentials: 'include' }),
        fetch('/api/contestants', { credentials: 'include' }),
        fetch('/api/answers', { credentials: 'include' }),
      ])

      if (qRes.status === 401) {
        router.push('/admin')
        return
      }

      const questions = qRes.ok ? await qRes.json() : []
      const contestants = cRes.ok ? await cRes.json() : []
      const answers = aRes.ok ? await aRes.json() : []

      setStats({
        questions: questions.length,
        teamA: contestants.filter((c: { team: string }) => c.team === 'A').length,
        teamB: contestants.filter((c: { team: string }) => c.team === 'B').length,
        wild: contestants.filter((c: { team: string }) => c.team === 'WILD').length,
        answers: answers.length,
      })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/admin')
  }

  const navLinks = [
    { href: '/admin/questions', label: 'الأسئلة', icon: '❓', desc: 'إدارة أسئلة اللعبة', color: 'from-violet-600 to-purple-700' },
    { href: '/admin/contestants', label: 'المتسابقون', icon: '👥', desc: 'إدارة المتسابقين', color: 'from-blue-600 to-cyan-700' },
    { href: '/admin/custom-questions', label: 'الأسئلة والإجابات', icon: '📝', desc: 'أسئلة مخصصة للمتسابقين ومدير الإجابات الصحيحة والخاطئة', color: 'from-emerald-600 to-teal-700' },
    { href: '/admin/game', label: 'التحكم باللعبة', icon: '🎮', desc: 'إدارة اللعبة المباشرة', color: 'from-amber-500 to-orange-600' },
    { href: '/admin/wild-questions', label: 'أسئلة الشخصية الخاصة', icon: '👶', desc: 'إضافة أسئلة مخصصة', color: 'from-amber-700 to-yellow-800' },
    { href: '/admin/settings', label: 'إعدادات المساعدات', icon: '⚙️', desc: 'تكلفة وتأثير المساعدات', color: 'from-slate-600 to-slate-700' },
  ]

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Gamely Dashboard</h1>
            <p className="text-slate-400 mt-1">Game administration panel</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            Sign Out
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="bg-slate-700 animate-pulse rounded-xl h-20" />
            ))
          ) : (
            <>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-violet-400">{stats.questions}</div>
                <div className="text-slate-400 text-sm mt-1">Questions</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{stats.teamA}</div>
                <div className="text-slate-400 text-sm mt-1">Team A</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{stats.teamB}</div>
                <div className="text-slate-400 text-sm mt-1">Team B</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-amber-400">{stats.wild}</div>
                <div className="text-slate-400 text-sm mt-1">Wild</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-emerald-400">{stats.answers}</div>
                <div className="text-slate-400 text-sm mt-1">Answers</div>
              </div>
            </>
          )}
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`bg-gradient-to-br ${link.color} rounded-2xl p-6 hover:opacity-90 transition-opacity group`}
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl">{link.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-white">{link.label}</h2>
                  <p className="text-white/70 text-sm">{link.desc}</p>
                </div>
                <span className="ml-auto text-white/50 group-hover:text-white/80 text-2xl transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
