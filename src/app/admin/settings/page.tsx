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
  timer_duration: number
  steal_correct_opponent_loss_pct: number
  steal_wrong_self_pct: number
  steal_wrong_opponent_pct: number
  steal_max_wager: number
  wild_correct_bonus_pct: number
  wild_wrong_opponent_pct: number
  wild_max_wager: number
  default_start_score: number
}

const DEFAULT_SETTINGS: Settings = {
  helpline_remove_two: { cost: 50, multiplier_reduction: 0.25 },
  helpline_same_person: { cost: 100, multiplier_reduction: 0.5 },
  helpline_opposing_team: { cost: 75, multiplier_reduction: 0.5 },
  timer_duration: 45,
  steal_correct_opponent_loss_pct: 1.0,
  steal_wrong_self_pct: 0.5,
  steal_wrong_opponent_pct: 1.5,
  steal_max_wager: 500,
  wild_correct_bonus_pct: 0.5,
  wild_wrong_opponent_pct: 0.5,
  wild_max_wager: 500,
  default_start_score: 1000,
}

const HELPLINE_INFO = [
  { key: 'helpline_remove_two', label: 'حذف إجابتين خاطئتين ✂️', icon: '✂️', color: 'red' },
  { key: 'helpline_same_person', label: 'تبديل السؤال - نفس المتسابق 🔄', icon: '🔄', color: 'purple' },
  { key: 'helpline_opposing_team', label: 'متسابق مختلف 🎲', icon: '🎲', color: 'cyan' },
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
        body: JSON.stringify({ ...settings }),
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

  type HelplineKey = 'helpline_remove_two' | 'helpline_same_person' | 'helpline_opposing_team'
  function updateSetting(key: HelplineKey, field: keyof HelplineSetting, value: number) {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const colorMap: Record<string, string> = {
    red: 'border-red-600/40 bg-red-900/10',
    purple: 'border-purple-600/40 bg-purple-900/10',
    cyan: 'border-cyan-600/40 bg-cyan-900/10',
  }
  const labelColorMap: Record<string, string> = {
    red: 'text-red-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">← رجوع</Link>
          <h1 className="text-2xl font-bold text-white">إعدادات اللعبة ⚙️</h1>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8">جاري التحميل...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">

            {/* General Settings */}
            <div className="border border-indigo-600/40 bg-indigo-900/10 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4 text-indigo-300">⚙️ إعدادات عامة</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 text-sm block mb-1">
                    مدة العد التنازلي (ثانية) — الحالي: {settings.timer_duration}ث
                  </label>
                  <input
                    type="number"
                    value={settings.timer_duration}
                    onChange={e => setSettings(prev => ({ ...prev, timer_duration: Math.max(10, Number(e.target.value)) }))}
                    min={10} max={300} step={5}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">الحد الأدنى 10 ثوانٍ</p>
                </div>
                <div>
                  <label className="text-slate-300 text-sm block mb-1">نقاط البداية الافتراضية</label>
                  <input
                    type="number"
                    value={settings.default_start_score}
                    onChange={e => setSettings(prev => ({ ...prev, default_start_score: Math.max(0, Number(e.target.value)) }))}
                    min={0} step={100}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">نقاط البداية لكل فريق</p>
                </div>
              </div>
            </div>

            {/* Steal Settings */}
            <div className="border border-orange-600/40 bg-orange-900/10 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4 text-orange-300">⚔️ إعدادات وضع السرقة</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-slate-300 text-sm block mb-1">الحد الأقصى للمراهنة (للسرقة)</label>
                  <input
                    type="number"
                    value={settings.steal_max_wager}
                    onChange={e => setSettings(prev => ({ ...prev, steal_max_wager: Math.max(100, Number(e.target.value)) }))}
                    min={100} max={1000} step={100}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">أقصى مراهنة تتيح وضع السرقة</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 text-sm block mb-1">
                    خسارة المنافس (صح) — {Math.round(settings.steal_correct_opponent_loss_pct * 100)}%
                  </label>
                  <input
                    type="number"
                    value={settings.steal_correct_opponent_loss_pct}
                    onChange={e => setSettings(prev => ({ ...prev, steal_correct_opponent_loss_pct: Math.max(0, Number(e.target.value)) }))}
                    min={0} max={3} step={0.1}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">نسبة المراهنة تُسرق من المنافس</p>
                </div>
                <div>
                  <label className="text-slate-300 text-sm block mb-1">
                    خسارة الفريق (خطأ) — {Math.round(settings.steal_wrong_self_pct * 100)}%
                  </label>
                  <input
                    type="number"
                    value={settings.steal_wrong_self_pct}
                    onChange={e => setSettings(prev => ({ ...prev, steal_wrong_self_pct: Math.max(0, Number(e.target.value)) }))}
                    min={0} max={3} step={0.1}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">نسبة المراهنة يخسرها الفريق</p>
                </div>
                <div>
                  <label className="text-slate-300 text-sm block mb-1">
                    مكافأة المنافس (خطأ) — {Math.round(settings.steal_wrong_opponent_pct * 100)}%
                  </label>
                  <input
                    type="number"
                    value={settings.steal_wrong_opponent_pct}
                    onChange={e => setSettings(prev => ({ ...prev, steal_wrong_opponent_pct: Math.max(0, Number(e.target.value)) }))}
                    min={0} max={3} step={0.1}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">نسبة المراهنة يحصل عليها المنافس</p>
                </div>
              </div>
              <div className="mt-3 bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
                <strong className="text-orange-300">مثال بمراهنة 500:</strong>
                {' '}إجابة صحيحة: الفريق يربح نقاطه + المنافس يخسر {Math.round(500 * settings.steal_correct_opponent_loss_pct)} نقطة.
                {' '}إجابة خاطئة: الفريق يخسر {Math.round(500 * settings.steal_wrong_self_pct)} نقطة + المنافس يكسب {Math.round(500 * settings.steal_wrong_opponent_pct)} نقطة.
              </div>
            </div>

            {/* Wild Mode Settings */}
            <div className="border border-amber-600/40 bg-amber-900/10 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4 text-amber-300">👶 إعدادات وضع الشخصية الخاصة</h3>
              <p className="text-slate-400 text-xs mb-4">
                وضع الشخصية الخاصة يستخدم أسئلة الشخصية العامة (wild questions) مع نظام نقاط مختلف.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-slate-300 text-sm block mb-1">الحد الأقصى للمراهنة</label>
                  <input
                    type="number"
                    value={settings.wild_max_wager}
                    onChange={e => setSettings(prev => ({ ...prev, wild_max_wager: Math.max(100, Number(e.target.value)) }))}
                    min={100} max={1000} step={100}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">أقصى مراهنة تتيح الوضع</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 text-sm block mb-1">
                    مكافأة الإجابة الصحيحة — +{Math.round(settings.wild_correct_bonus_pct * 100)}%
                  </label>
                  <input
                    type="number"
                    value={settings.wild_correct_bonus_pct}
                    onChange={e => setSettings(prev => ({ ...prev, wild_correct_bonus_pct: Math.max(0, Number(e.target.value)) }))}
                    min={0} max={3} step={0.1}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">مكافأة إضافية فوق المراهنة</p>
                </div>
                <div>
                  <label className="text-slate-300 text-sm block mb-1">
                    مكافأة المنافس (خطأ) — {Math.round(settings.wild_wrong_opponent_pct * 100)}%
                  </label>
                  <input
                    type="number"
                    value={settings.wild_wrong_opponent_pct}
                    onChange={e => setSettings(prev => ({ ...prev, wild_wrong_opponent_pct: Math.max(0, Number(e.target.value)) }))}
                    min={0} max={3} step={0.1}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">نسبة المراهنة يحصل عليها المنافس</p>
                </div>
              </div>
              <div className="mt-3 bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
                <strong className="text-amber-300">مثال بمراهنة 300:</strong>
                {' '}إجابة صحيحة: +{Math.round(300 * (1 + settings.wild_correct_bonus_pct))} نقطة.
                {' '}إجابة خاطئة: −300 نقطة + المنافس يكسب {Math.round(300 * settings.wild_wrong_opponent_pct)} نقطة.
              </div>
            </div>

            {/* Helpline Settings */}
            <div className="border border-slate-600/40 bg-slate-800/20 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-2 text-slate-300">🆘 إعدادات المساعدات</h3>
              <p className="text-slate-500 text-xs mb-4">
                كل مساعدة لها تكلفة بالنقاط وتخفيض في نسبة الأرباح. مثال: تخفيض 25% يعني الفريق يحصل على 75% من المراهنة.
              </p>
              <div className="space-y-3">
                {HELPLINE_INFO.map(({ key, label, color }) => {
                  const s = settings[key as HelplineKey]
                  return (
                    <div key={key} className={`border rounded-xl p-4 ${colorMap[color]}`}>
                      <h4 className={`font-bold text-base mb-3 ${labelColorMap[color]}`}>{label}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-slate-300 text-sm block mb-1">التكلفة (نقاط)</label>
                          <input
                            type="number"
                            value={s.cost}
                            onChange={e => updateSetting(key as HelplineKey, 'cost', Number(e.target.value))}
                            min={0} step={25}
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
                            onChange={e => updateSetting(key as HelplineKey, 'multiplier_reduction', Number(e.target.value))}
                            min={0} max={0.75} step={0.05}
                            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

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
