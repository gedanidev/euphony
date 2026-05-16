import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || '/api'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
            <p className="text-sm text-green-400">{t('auth.resetSuccess')}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="space-y-1">
                <label className="text-xs text-[#94a3b8]">{t('auth.newPassword')}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#0f0f13] border border-[#2e2e4a] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#94a3b8]">{t('auth.confirmPassword')}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full bg-[#0f0f13] border border-[#2e2e4a] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                {loading ? t('auth.resetting') : t('auth.resetBtn')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
