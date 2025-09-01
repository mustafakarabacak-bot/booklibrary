import React, { useEffect, useMemo, useState } from 'react'
import { updateProfile } from 'firebase/auth'
import { useAuth } from '../auth/AuthContext'
import { db, storage } from '../firebase'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

export default function Profile() {
  const { user } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEmail(user?.email || '')
    setPhotoURL(user?.photoURL || '')
  }, [user])

  // Kullanıcı Firestore profilini çek
  useEffect(() => {
    const run = async () => {
      if (!user) return
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists()) {
          const d: any = snap.data()
          setFirstName(d.firstName || '')
          setLastName(d.lastName || '')
          setPhone(d.phone || '')
          setBirthDate(d.birthDate || '')
          setGender(d.gender || '')
          setCountry(d.country || '')
          setCity(d.city || '')
          if (!photoURL) setPhotoURL(d.photoURL || user.photoURL || '')
        } else {
          // displayName'i isim/soyisim için kaba bölme
          const dn = user.displayName || ''
          const parts = dn.split(' ')
          setFirstName(parts[0] || '')
          setLastName(parts.slice(1).join(' ') || '')
        }
      } catch (e: any) {
        // okuma hatasını yumuşat
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const initials = useMemo(() => {
    const parts = [firstName, lastName].filter(Boolean)
    const first = parts[0]?.charAt(0) || (email ? email.charAt(0) : '')
    const second = parts[1]?.charAt(0) || ''
    return (first + second).toUpperCase()
  }, [firstName, lastName, email])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      let newPhotoURL = photoURL
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const fileRef = ref(storage, `users/${user.uid}/avatar.${ext}`)
        await uploadBytes(fileRef, photoFile)
        newPhotoURL = await getDownloadURL(fileRef)
        setPhotoURL(newPhotoURL)
      }

      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || null
      await updateProfile(user, { displayName, photoURL: newPhotoURL || null })

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        birthDate: birthDate || null,
        gender: gender || null,
        country: country || null,
        city: city || null,
        photoURL: newPhotoURL || null,
        updatedAt: serverTimestamp(),
      }, { merge: true })

      setMessage('Profil güncellendi')
    } catch (err: any) {
      setError(err.message || 'Profil güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid-center" style={{ alignItems: 'start' }}>
      <div className="panel" style={{ width: '100%', maxWidth: 720 }}>
        <h2 style={{ marginTop: 0 }}>Profil</h2>
        <p className="muted">Hesap bilgilerinizi görüntüleyin ve düzenleyin.</p>

        <form className="form" onSubmit={onSave} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {photoURL ? (
              <img className="avatar" src={photoURL} alt="Profil" style={{ width: 56, height: 56 }} />
            ) : (
              <div className="avatar-fallback" style={{ width: 56, height: 56 }}>{initials || 'K'}</div>
            )}
            <div>
              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                Fotoğraf Seç
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              </label>
              {photoFile && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{photoFile.name}</span>}
            </div>
          </div>

          <div className="row">
            <label>
              İsim
              <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="İsim" />
            </label>
            <label>
              Soyisim
              <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Soyisim" />
            </label>
          </div>

          <label>
            E-posta
            <input className="input" value={email} disabled readOnly placeholder="E-posta" />
          </label>

          <div className="row">
            <label>
              Telefon
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
            </label>
            <label>
              Doğum Tarihi
              <input className="input" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            </label>
          </div>

          <div className="row">
            <label>
              Cinsiyet
              <select className="input" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Seçiniz</option>
                <option value="kadın">Kadın</option>
                <option value="erkek">Erkek</option>
                <option value="diger">Diğer</option>
                <option value="belirtmek-istemiyorum">Belirtmek istemiyorum</option>
              </select>
            </label>
            <label>
              Ülke
              <input className="input" value={country} onChange={e => setCountry(e.target.value)} placeholder="Ülke" />
            </label>
          </div>

          <label>
            Şehir
            <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Şehir" />
          </label>
          {error && <div className="danger" style={{ fontSize: 14 }}>{error}</div>}
          {message && <div className="muted" style={{ fontSize: 14 }}>{message}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" disabled={saving} type="submit">Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  )
}
