import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { auth, db, googleProvider } from '../firebase'
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

export default function Register({ embedded }: { embedded?: boolean }) {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  // Parola kayıt sırasında alınmayacak; kullanıcı e-postadan oluşturacak
  const [displayName, setDisplayName] = useState('')
  const [surname, setSurname] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function postCreateProfile(uid: string, profile: { displayName?: string; phone?: string; firstName?: string; lastName?: string; email?: string }) {
    await setDoc(doc(db, 'users', uid), {
      uid,
      displayName: profile.displayName || null,
      phone: profile.phone || null,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      email: profile.email || null,
      createdAt: serverTimestamp(),
    }, { merge: true })
  }

  async function handleEmailRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Geçici güçlü bir parola üret (kullanıcı ilk şifresini e-postadan belirleyecek)
      const temp = Array.from(crypto.getRandomValues(new Uint32Array(4)))
        .map(n => n.toString(36)).join('').slice(0, 16) + 'A!1'
      const cred = await createUserWithEmailAndPassword(auth, email, temp)
      const fullName = [displayName, surname].filter(Boolean).join(' ')
      if (fullName) {
        await updateProfile(cred.user, { displayName: fullName })
      }
  await postCreateProfile(cred.user.uid, { displayName: fullName, phone, firstName: displayName || undefined, lastName: surname || undefined, email })
      // Şifre oluşturma linkini gönder
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      } as const
      try { await sendPasswordResetEmail(auth, email, actionCodeSettings) } catch {}
      // Geçici girişten çıkış yap ve bilgilendirme sayfasına yönlendir
      try { await signOut(auth) } catch {}
      nav('/create-password-email-sent')
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
      const cred = await signInWithPopup(auth, googleProvider)
  await postCreateProfile(cred.user.uid, { displayName: cred.user.displayName || undefined, email: cred.user.email || undefined })
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
            <h2>Kayıt Ol</h2>
            <p className="lead">Yeni bir hesap oluştur.</p>
          </div>
        ) : (
          <>
            <h2>Kayıt Ol</h2>
            <p className="lead">Yeni bir hesap oluştur.</p>
          </>
        )}
        {error && <p className="danger auth-error">{error}</p>}
        <form onSubmit={handleEmailRegister} className="form auth-form">
          <div className="row">
            <input className="input" placeholder="İsim" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <input className="input" placeholder="Soyisim" value={surname} onChange={(e) => setSurname(e.target.value)} />
          </div>
          <input className="input" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="card-actions">
            <button className="btn" disabled={loading} type="submit">Devam Et</button>
            <button className="btn btn-ghost" type="button" onClick={handleGoogle} disabled={loading}>Google ile Devam Et</button>
          </div>
          <p className="muted">Zaten hesabın var mı? <Link className="link" to="/login">Giriş yap</Link></p>
        </form>
      </div>
    </div>
  )
}
