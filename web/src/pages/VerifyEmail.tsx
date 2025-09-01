import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { auth } from '../firebase'
import { sendEmailVerification, signOut, reload } from 'firebase/auth'

export default function VerifyEmail() {
  const user = auth.currentUser
  const [sent, setSent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    setError(null)
    if (!user) return setError('Oturum yok')
    try {
  await sendEmailVerification(user, { url: `${window.location.origin}/login`, handleCodeInApp: false })
      setSent(true)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleCheck() {
    setChecking(true)
    try {
      if (!auth.currentUser) throw new Error('Oturum yok')
      await reload(auth.currentUser)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setChecking(false)
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
            <h2>E-postanı Doğrula</h2>
            <p className="lead">Mail kutunu kontrol et. Doğrulama bağlantısına tıklayınca bu sayfayı yenile.</p>
          </div>
          {error && <p className="danger auth-error">{error}</p>}
          <div className="card-actions">
            <button className="btn" onClick={handleResend} disabled={sent}>{sent ? 'Tekrar Gönderildi' : 'Doğrulama Maili Gönder'}</button>
            <button className="btn btn-ghost" onClick={handleCheck} disabled={checking}>Yenile ve Kontrol Et</button>
            <Link className="btn btn-ghost" to="/login" onClick={() => signOut(auth)}>Çıkış Yap</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
