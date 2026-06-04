import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'
const TURNSTILE_SITE_KEY = import.meta.env.VITE_CF_TURNSTILE_SITE_KEY || ''

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="min-h-dvh bg-[#0f0f13] flex items-center justify-center p-4">
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#E0E0E0]">{t('auth.email')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#0f0f13] border border-[#3e3e5a] rounded-lg pl-10 pr-3 py-3 text-base text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all min-h-[48px]"
                placeholder="email@ejemplo.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#E0E0E0]">{t('auth.password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#0f0f13] border border-[#3e3e5a] rounded-lg pl-10 pr-12 py-3 text-base text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all min-h-[48px]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#94a3b8] hover:text-[#e2e8f0] transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/30 rounded"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div ref={mountTurnstile} />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3.5 px-4 rounded-lg text-base transition-all min-h-[48px] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            {loading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('auth.loggingIn')}
              </>
            ) : (
              t('auth.loginBtn')
            )}
          </button>

          <div className="text-center pt-2">
            <Link
              to="/forgot-password"
              className="text-sm text-[#94a3b8] hover:text-purple-400 transition-colors inline-block py-2 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500/30 rounded"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
