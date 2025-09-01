import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { db, storage } from '../firebase'
import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export default function NewBook() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('tr')
  const [category, setCategory] = useState('Genel')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onPickCover = (f: File | null) => {
    setCoverFile(f)
    if (f) {
      const url = URL.createObjectURL(f)
      setCoverPreview(url)
    } else {
      setCoverPreview(null)
    }
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!user) { setError('Oturum bulunamadı'); return }
    if (!title.trim()) { setError('Başlık gerekli'); return }
    setSaving(true)
    try {
      // 1) Kitabı kapaksız oluştur
      const docRef = await addDoc(collection(db, 'books'), {
        ownerId: user.uid,
        title: title.trim(),
        status: 'draft',
        language,
        category,
        coverUrl: null,
        chapterCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // 2) Kapak varsa yükle ve coverUrl'i güncelle
      if (coverFile) {
        const ext = coverFile.name.split('.').pop() || 'jpg'
        const objectRef = ref(storage, `users/${user.uid}/books/${docRef.id}/cover.${ext}`)
        await uploadBytes(objectRef, coverFile)
        const url = await getDownloadURL(objectRef)
        await updateDoc(doc(db, 'books', docRef.id), {
          coverUrl: url,
          updatedAt: serverTimestamp(),
        })
      }

      // 3) Kitap sayfasına yönlendir
      navigate(`/books/${docRef.id}`)
    } catch (err: any) {
      setError(err.message || 'Kitap oluşturulamadı')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid-center" style={{ alignItems: 'start' }}>
      <div className="panel" style={{ width: '100%', maxWidth: 720 }}>
        <h2 style={{ marginTop: 0 }}>Yeni Kitap</h2>
        <p className="muted">Başlık, dil, kategori ve varsa kapak görselini belirle.</p>
        {error && <div className="danger" style={{ marginTop: 8 }}>{error}</div>}
        <form className="form" onSubmit={onCreate} style={{ marginTop: 12 }}>
          <label>
            Başlık
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kitap başlığı" />
          </label>
          <div className="row">
            <label>
              Dil
              <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="tr">Türkçe</option>
                <option value="en">İngilizce</option>
                <option value="de">Almanca</option>
                <option value="fr">Fransızca</option>
              </select>
            </label>
            <label>
              Kategori
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Genel</option>
                <option>Roman</option>
                <option>Hikaye</option>
                <option>Şiir</option>
                <option>Kişisel Gelişim</option>
                <option>Bilim</option>
                <option>Teknoloji</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {coverPreview ? (
              <img src={coverPreview} alt="Önizleme" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
            ) : (
              <div className="tile-cover placeholder" style={{ width: 80, height: 100, borderRadius: 8 }} />
            )}
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              Kapak Seç
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onPickCover(e.target.files?.[0] || null)} />
            </label>
            {coverFile && <span className="muted" style={{ fontSize: 12 }}>{coverFile.name}</span>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Vazgeç</button>
            <button className="btn" disabled={saving || !title.trim()} type="submit">Oluştur</button>
          </div>
        </form>
      </div>
    </div>
  )
}
