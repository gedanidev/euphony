import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { Lock, Eye, EyeOff } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

function PasswordStrength({ password }) {
  const checks = [
    { label: 'Mín. 8 caracteres', met: password.length >= 8 },
    { label: 'Mayúscula', met: /[A-Z]/.test(password) },
    { label: 'Minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /\d/.test(password) },
    { label: 'Símbolo', met: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.met).length
  const colors = ['bg-red-500', 'bg-red-400', 'bg-yellow-500', 'bg-green-400', 'bg-green-500']
  const labels = ['Muy débil', 'Débil', 'Regular', 'Fuerte', 'Muy fuerte']

  if (!password) return null

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {checks.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score - 1] : 'bg-[#2e2e4a]'}`} />
        ))}
      </div>
      <p className="text-xs text-[#94a3b8]">{labels[score - 1] || 'Muy débil'}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map(c => (
          <span key={c.label} className={`text-xs ${c.met ? 'text-green-400' : 'text-[#64748b]'}`}>
            {c.met ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ResetPassword() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (!token) {
      setError(t('auth.invalidToken'))
      return
    }
    setLoading(true)
    try {
      await axios.post(`${API}/auth/reset-password`, { token, new_password: password })
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      setError(err.response?.data?.detail || t('auth.invalidToken'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#0f0f13] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            Euphony
          </span>
        </div>

        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-semibold text-[#e2e8f0]">{t('auth.resetTitle')}</h1>

          {success ? (
            <div className="space-y-4">
              <p className="text-sm text-green-400">{t('auth.resetSuccess')}</p>
              <p className="text-xs text-[#94a3b8]">Redirigiendo al login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#E0E0E0]">{t('auth.newPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-[#0f0f13] border border-[#3e3e5a] rounded-lg pl-10 pr-12 py-3 text-base text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all min-h-[48px]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#94a3b8] hover:text-[#e2e8f0] transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/30 rounded"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#E0E0E0]">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full bg-[#0f0f13] border border-[#3e3e5a] rounded-lg pl-10 pr-12 py-3 text-base text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all min-h-[48px]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#94a3b8] hover:text-[#e2e8f0] transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/30 rounded"
                    aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3.5 px-4 rounded-lg text-base transition-all min-h-[48px] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('auth.resetting')}
                  </>
                ) : (
                  t('auth.resetBtn')
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
