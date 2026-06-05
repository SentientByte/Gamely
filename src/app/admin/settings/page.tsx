'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface HelplineSetting {
  cost: number
  multiplier_reduction: number
}

interface Settings {
  helpline_remove_two: HelplineSetting
  helpline_same_person: HelplineSetting
  helpline_opposing_team: HelplineSetting
  helpline_wild: HelplineSetting
}

const DEFAULT_SETTINGS: Settings = {
  helpline_remove_two: { cost: 50, multiplier_reduction: 0.25 },
  helpline_same_person: { cost: 100, multiplier_reduction: 0.5 },
  helpline_opposing_team: { cost: 75, multiplier_reduction: 0.5 },
  helpline_wild: { cost: 200, multiplier_reduction: 0.5 },
}

const HELPLINE_INFO = [
  { key: 'helpline_remove_two', label: 'حذف إجابتين خاطئتين ✂️', icon: '✂️', color: 'red' },
  { key: 'helpline_same_person', label: 'تبديل السؤال - نفس المتسابق 🔄', icon: '🔄', color: 'purple' },
  { key: 'helpline_opposing_team', label: 'متسابق مختلف 🎲', icon: '🎲', color: 'cyan' },
  { key: 'helpline_wild', label: 'الشخصية الخاصة 👶', icon: '👶', color: 'amber' },
] as const

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings', { credentials: 'include' })
      if (res.status === 401) { router.push('/admin'); return }
      if (res.ok) {
        const data = await res.json()
        setSettings({ ...DEFAULT_SETTINGS, ...data })
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        alert('حدث خطأ في الحفظ')
      }
    } finally {
      setSaving(false)
    }
  }

  function updateSetting(key: keyof Settings, field: keyof HelplineSetting, value: number) {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const colorMap: Record<string, string> = {
    red: 'border-red-600/40 bg-red-900/10',
    purple: 'border-purple-600/40 bg-purple-900/10',
    cyan: 'border-cyan-600/40 bg-cyan-900/10',
    amber: 'border-amber-600/40 bg-amber-900/10',
  }
  const labelColorMap: Record<string, string> = {
    red: 'text-red-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← رجوع</Link>
          <h1 className="text-2xl font-bold text-white">إعدادات المساعدات ⚙️</h1>
        </div>

        <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4 mb-6 text-slate-400 text-sm">
          <strong className="text-yellow-400">ملاحظة:</strong> كل مساعدة لها تكلفة بالنقاط وتخفيض في نسبة الأرباح. مثال: تخفيض 25% يعني أن الفريق سيحصل على 75% من المراهنة عند الإجابة الصحيحة.
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8">جاري التحميل...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {HELPLINE_INFO.map(({ key, label, color }) => {
              const s = settings[key as keyof Settings]
              return (
                <div key={key} className={`border rounded-xl p-5 ${colorMap[color]}`}>
                  <h3 className={`font-bold text-lg mb-4 ${labelColorMap[color]}`}>{label}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-300 text-sm block mb-1">التكلفة (نقاط)</label>
                      <input
                        type="number"
                        value={s.cost}
                        onChange={e => updateSetting(key as keyof Settings, 'cost', Number(e.target.value))}
                        min={0}
                        step={25}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 text-sm block mb-1">
                        تخفيض الأرباح ({Math.round(s.multiplier_reduction * 100)}% ← الأرباح {Math.round((1 - s.multiplier_reduction) * 100)}%)
                      </label>
                      <input
                        type="number"
                        value={s.multiplier_reduction}
                        onChange={e => updateSetting(key as keyof Settings, 'multiplier_reduction', Number(e.target.value))}
                        min={0}
                        max={0.75}
                        step={0.05}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                      <p className="text-slate-500 text-xs mt-1">
                        مثال: 0.25 يعني الفريق يحصل على {Math.round((1 - s.multiplier_reduction) * 100)}% من المراهنة
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}

            <button
              type="submit"
              disabled={saving}
              className={`w-full font-bold py-3 rounded-xl transition-colors text-lg ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-50'
              }`}
            >
              {saved ? '✓ تم الحفظ' : saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
