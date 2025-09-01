import React, { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'

export default function ResetPassword() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const oobCode = sp.get('oobCode') || ''
  const [email, setEmail] = useState<string>('')
  const [pwd1, setPwd1] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        if (!oobCode) throw new Error('Geçersiz bağlantı')
        const mail = await verifyPasswordResetCode(auth, oobCode)
        if (mounted) setEmail(mail)
      } catch (e: any) {
        setError(e?.message || 'Kod doğrulanamadı')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [oobCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!oobCode) return setError('Geçersiz bağlantı')
    if (pwd1.length < 6) return setError('Şifre en az 6 karakter olmalı')
    if (pwd1 !== pwd2) return setError('Şifreler eşleşmiyor')
    try {
      await confirmPasswordReset(auth, oobCode, pwd1)
      setDone(true)
    } catch (e: any) {
      setError(e?.message || 'Şifre sıfırlanamadı')
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
            <h2>Yeni Şifre</h2>
            <p className="lead">{loading ? 'Yükleniyor…' : email ? `${email} için yeni şifre belirle.` : 'Bağlantı geçersiz veya süresi dolmuş.'}</p>
          </div>
          {error && <p className="danger auth-error">{error}</p>}
          {!loading && !done && email && (
            <form onSubmit={handleSubmit} className="form auth-form">
              <input className="input" type="password" placeholder="Yeni şifre" value={pwd1} onChange={(e) => setPwd1(e.target.value)} />
              <input className="input" type="password" placeholder="Yeni şifre (tekrar)" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
              <div className="card-actions">
                <button className="btn" type="submit">Devam Et</button>
                <Link className="btn btn-ghost" to="/login">İptal</Link>
              </div>
            </form>
          )}
          {done && (
            <>
              <p className="muted">Şifren güncellendi. Şimdi giriş yapabilirsin.</p>
              <div className="card-actions">
                <button className="btn" onClick={() => nav('/login')}>Girişe Dön</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
