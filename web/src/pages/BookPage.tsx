import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../firebase'
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, serverTimestamp } from 'firebase/firestore'
import { storage } from '../firebase'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

type OutlineItem = { title: string; summary?: string }
type ChapterDoc = { index: number; draft: string; approved?: boolean }

export default function BookPage() {
  const { id } = useParams<{ id: string }>()
  const [title, setTitle] = useState('Kitap')
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [chapters, setChapters] = useState<ChapterDoc[]>([])
  const [current, setCurrent] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true); setError(null)
    ;(async () => {
      try {
        const planRef = doc(db, 'books', id, 'meta', 'plan')
        const snap = await getDoc(planRef)
        if (snap.exists()) {
          const d = snap.data() as any
          setTitle(d.title || 'Kitap')
          setOutline(Array.isArray(d.outline) ? d.outline : [])
        }
        const bookRef = doc(db, 'books', id)
        const bookSnap = await getDoc(bookRef)
        if (bookSnap.exists()) {
          const b = bookSnap.data() as any
          setCoverUrl(b.coverUrl || null)
        }
        const qy = query(collection(db, 'books', id, 'chapters'), orderBy('index', 'asc'))
        const cs = await getDocs(qy)
        const arr = cs.docs.map(d => d.data() as ChapterDoc)
        setChapters(arr)
        const firstWithDraft = arr.find(c => (c.draft || '').trim())
        setCurrent(firstWithDraft?.index || 1)
      } catch (e: any) {
        setError(e.message || 'Kitap verileri yüklenemedi')
      } finally { setLoading(false) }
    })()
  }, [id])

  const chapterTitle = (i: number) => {
    const item = outline[i - 1]
    return item ? `${i}. ${item.title}` : `Bölüm ${i}`
  }

  const ch = chapters.find(c => c.index === current)
  const maxIndex = Math.max(outline.length, chapters.length || 0)

  async function onChangeCover(file: File | null) {
    if (!id || !file) return
    try {
      setUploading(true)
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const objectRef = ref(storage, `books/${id}/cover.${ext}`)
      await uploadBytes(objectRef, file)
      const url = await getDownloadURL(objectRef)
      await updateDoc(doc(db, 'books', id), { coverUrl: url, updatedAt: serverTimestamp() })
      setCoverUrl(url)
    } catch (e: any) {
      setError(e.message || 'Kapak güncellenemedi')
    } finally { setUploading(false) }
  }

  return (
    <div className="writer-shell">
      {/* Sol: Bölümler listesi + Düzenle */}
      <aside className="writer-sidebar">
        <div className="panel">
          <div className="row-header" style={{ marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {id && (
              <Link className="btn" to={`/books/${id}/write?ch=${current}`}>Düzenle</Link>
            )}
          </div>
          {/* Kapak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {coverUrl ? (
              <img src={coverUrl} alt="Kapak" style={{ width: 90, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
            ) : (
              <div className="tile-cover placeholder" style={{ width: 90, height: 120, borderRadius: 8 }} />
            )}
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              Kapağı Değiştir
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onChangeCover(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="chapter-list">
            {Array.from({ length: Math.max(maxIndex, 1) }, (_, i) => i + 1).map(i => {
              const item = chapters.find(c => c.index === i)
              const active = i === current
              return (
                <button key={i} className={`chapter-item ${active ? 'is-active' : ''}`} onClick={() => setCurrent(i)}>
                  <div className="chapter-title">{chapterTitle(i)}</div>
                  <div className="chapter-meta">{item?.approved ? 'Onaylı' : item?.draft ? 'Taslak' : 'Boş'}</div>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Orta: Okuma alanı */}
      <main className="writer-editor">
        <div className="panel">
          <div className="row-header">
            <h3 style={{ margin: 0 }}>{chapterTitle(current)}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" disabled={current <= 1} onClick={() => setCurrent(c => Math.max(1, c - 1))}>Önceki</button>
              <button className="btn btn-ghost" disabled={current >= maxIndex} onClick={() => setCurrent(c => Math.min(maxIndex, c + 1))}>Sonraki</button>
            </div>
          </div>
          {loading && <div className="muted">Yükleniyor…</div>}
          {error && <div className="danger">{error}</div>}
          {!loading && !error && (
            ch?.draft ? (
              <article style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ch.draft}</article>
            ) : (
              <div className="muted">Bu bölüm boş. Sol üstten Düzenle ile Yazma Asistanı’na geçebilirsiniz.</div>
            )
          )}
        </div>
      </main>

      {/* Sağ: Outline */}
      <aside className="writer-right">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Outline</h3>
          {outline.length > 0 ? (
            <ol style={{ paddingLeft: 16 }}>
              {outline.map((o, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <strong>{i + 1}. {o.title}</strong>
                  {o.summary && <div className="muted">{o.summary}</div>}
                </li>
              ))}
            </ol>
          ) : (
            <div className="muted">Outline henüz oluşturulmamış.</div>
          )}
        </div>
      </aside>
    </div>
  )
}
