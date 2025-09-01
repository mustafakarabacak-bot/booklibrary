import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { auth, googleProvider } from '../firebase'
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'

export default function Login({ embedded }: { embedded?: boolean }) {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      nav('/')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      nav('/')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={embedded ? undefined : 'grid-center'}>
      <div className={embedded ? undefined : 'card'}>
        {embedded ? (
          <div className="auth-header">
            <h2>Giriş Yap</h2>
            <p className="lead">Hesabına erişmek için bilgilerini gir.</p>
          </div>
        ) : (
          <>
            <h2>Giriş Yap</h2>
            <p className="lead">Hesabına erişmek için bilgilerini gir.</p>
          </>
        )}
        {error && <p className="danger auth-error">{error}</p>}
        <form onSubmit={handleEmailLogin} className="form auth-form">
          <input className="input" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="input-group">
            <input className="input" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} type={showPwd ? 'text' : 'password'} />
            <button className="icon-btn-inline" type="button" onClick={() => setShowPwd(s => !s)} aria-label="Şifreyi göster/gizle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {showPwd ? (
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
                {showPwd && <path d="M1 1l22 22" />}
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <Link className="link" to="/forgot-password">Şifreni mi unuttun?</Link>
          </div>
          <div className="card-actions">
            <button className="btn" disabled={loading} type="submit">Giriş</button>
            <button className="btn btn-ghost" type="button" onClick={handleGoogle} disabled={loading}>Google ile Giriş</button>
          </div>
          <p className="muted">Hesabın yok mu? <Link className="link" to="/register">Kayıt ol</Link></p>
        </form>
      </div>
    </div>
  )
}
