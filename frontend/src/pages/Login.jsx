import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

const API = import.meta.env.VITE_API_URL || '/api'
const TURNSTILE_SITE_KEY = import.meta.env.VITE_CF_TURNSTILE_SITE_KEY || ''

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const widgetRef = useRef(null)
  const widgetIdRef = useRef(null)

  function mountTurnstile(el) {
    if (!el || widgetIdRef.current !== null) return
    widgetRef.current = el
    if (window.turnstile && TURNSTILE_SITE_KEY) {
      widgetIdRef.current = window.turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        size: 'invisible',
        callback: (token) => submitWithToken(token),
        'error-callback': () => {
          setError('Turnstile error. Please try again.')
          setLoading(false)
        },
      })
    }
  }

  async function submitWithToken(turnstile_token) {
    try {
      const { data } = await axios.post(
        `${API}/auth/login`,
        { email, password, turnstile_token },
        { withCredentials: true }
      )
      login(data)
      navigate('/playlists', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
      setLoading(false)
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current)
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (window.turnstile && TURNSTILE_SITE_KEY && widgetIdRef.current !== null) {
      window.turnstile.execute(widgetIdRef.current)
    } else {
      await submitWithToken('dev-token')
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

        <form
          onSubmit={handleSubmit}
          className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 space-y-4"
        >
          <h1 className="text-lg font-semibold text-[#e2e8f0]">{t('auth.login')}</h1>

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

          <div className="space-y-1">
            <label className="text-xs text-[#94a3b8]">{t('auth.password')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0f0f13] border border-[#2e2e4a] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
            />
          </div>

          <div ref={mountTurnstile} />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            {loading ? t('auth.loggingIn') : t('auth.loginBtn')}
          </button>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-xs text-[#94a3b8] hover:text-purple-400 transition-colors"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
