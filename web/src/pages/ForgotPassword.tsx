import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { auth } from '../firebase'
import { sendPasswordResetEmail } from 'firebase/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const actionCodeSettings = {
        // Prod URL'ini kullanın; dev ortamı için localhost eklenebilir
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      }
      await sendPasswordResetEmail(auth, email, actionCodeSettings)
      setSent(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-center">
      <div className="flip-scene">
        <div className="auth-logo-over">
          <img src="/logo.png" alt="BookLibrary" className="auth-logo" />
        </div>
        <div className="card card-sharp">
          <div className="auth-header">
            <h2>Şifre Sıfırla</h2>
            <p className="lead">E-posta adresine bir sıfırlama bağlantısı gönderelim.</p>
          </div>
          {error && <p className="danger auth-error">{error}</p>}
          {!sent ? (
            <form onSubmit={handleSubmit} className="form auth-form">
              <input
                className="input"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
              <div className="card-actions">
                <button className="btn" type="submit" disabled={loading}>Gönder</button>
                <Link to="/login" className="btn btn-ghost">Geri Dön</Link>
              </div>
            </form>
          ) : (
            <>
              <p className="muted">Eğer bu adres kayıtlıysa, sıfırlama bağlantısı gönderildi.</p>
              <div className="card-actions">
                <Link to="/login" className="btn">Girişe Dön</Link>
                <button className="btn btn-ghost" onClick={() => setSent(false)}>Tekrar Dene</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
