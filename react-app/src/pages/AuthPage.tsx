import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { ShoppingBag } from 'lucide-react'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const { t, lang, setLang } = useLang()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({ email: '', password: '', full_name: '', shop_name: '' })

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    try {
      if (mode === 'login') {
        const { error: err } = await signIn(form.email, form.password)
        if (err) setError(err)
      } else {
        if (!form.full_name || !form.shop_name) { setError('Please fill all fields'); setLoading(false); return }
        const { error: err } = await signUp(form.email, form.password, form.full_name, form.shop_name)
        if (err) setError(err)
        else {
          setSuccess(lang === 'sw' ? 'Akaunti imefunguliwa! Angalia barua pepe yako.' : 'Account created! Check your email to confirm.')
          setForm({ email: '', password: '', full_name: '', shop_name: '' })
          setMode('login')
        }
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-lang-toggle">
        <div className="lang-toggle">
          <button className={`lang-btn ${lang === 'sw' ? 'active' : ''}`} onClick={() => setLang('sw')}>SW</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-badge">
            <ShoppingBag size={30} color="var(--accent)" />
          </div>
          <h1>myShopCare</h1>
          <p>{mode === 'login' ? t('welcome_back') : t('create_shop')}</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); setSuccess('') }}
          >
            {t('login')}
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); setSuccess('') }}
          >
            {t('register')}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label>{t('full_name')}</label>
                <input type="text" value={form.full_name} onChange={e => update('full_name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>{t('shop_name')}</label>
                <input type="text" value={form.shop_name} onChange={e => update('shop_name', e.target.value)} required placeholder={lang === 'sw' ? 'Mfano: Duka la Mama Amina' : 'e.g. Mama Amina Store'} />
              </div>
            </>
          )}
          <div className="form-group">
            <label>{t('email')}</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input type="password" value={form.password} onChange={e => update('password', e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? t('loading') : (mode === 'login' ? t('login') : t('register'))}
          </button>
        </form>
      </div>
    </div>
  )
}
