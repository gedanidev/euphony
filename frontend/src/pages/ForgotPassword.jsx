import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || '/api'
const TURNSTILE_SITE_KEY = import.meta.env.VITE_CF_TURNSTILE_SITE_KEY || ''

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const widgetIdRef = useRef(null)

  function mountTurnstile(el) {
    if (!el || widgetIdRef.current !== null) return
    if (window.turnstile && TURNSTILE_SITE_KEY) {
      widgetIdRef.current = window.turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        size: 'invisible',
        callback: (token) => sendRequest(token),
        'error-callback': () => {
          setError('Turnstile error. Please try again.')
          setLoading(false)
        },
      })
    }
  }

  async function sendRequest(turnstile_token) {
    try {
      await axios.post(`${API}/auth/forgot-password`, { email, turnstile_token })
      setSent(true)
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (window.turnstile && TURNSTILE_SITE_KEY && widgetIdRef.current !== null) {
      window.turnstile.execute(widgetIdRef.current)
    } else {
      sendRequest('dev-token')
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            Euphony
          </span>
        </div>

        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-semibold text-[#e2e8f0]">{t('auth.forgotTitle')}</h1>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-green-400">{t('auth.linkSent')}</p>
              <Link to="/login" className="block text-center text-xs text-[#94a3b8] hover:text-purple-400">
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-[#94a3b8]">{t('auth.forgotDesc')}</p>

              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="space-y-1">
                <label className="text-xs text-[#94a3b8]">{t('auth.email')}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#0f0f13] border border-[#2e2e4a] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
                />
              </div>

              <div ref={mountTurnstile} />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                {loading ? t('auth.sending') : t('auth.sendLink')}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-xs text-[#94a3b8] hover:text-purple-400">
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
