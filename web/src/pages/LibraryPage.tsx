import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { doc, getDoc, collection, where, query, getDocs } from 'firebase/firestore'

export default function LibraryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lib, setLib] = useState<any | null>(null)
  const [books, setBooks] = useState<any[]>([])

  useEffect(() => {
    const run = async () => {
      if (!id) return
      const snap = await getDoc(doc(db, 'libraries', id))
      if (!snap.exists()) return
      const data: any = { id: snap.id, ...snap.data() }
      setLib(data)
      if (Array.isArray(data.bookIds) && data.bookIds.length > 0) {
        const q = query(collection(db, 'books'), where('__name__', 'in', data.bookIds.slice(0, 10)))
        const bs = await getDocs(q)
        setBooks(bs.docs.map(d => ({ id: d.id, ...d.data() })) as any[])
      } else {
        setBooks([])
      }
    }
    run()
  }, [id])

  return (
    <div className="grid-center" style={{ alignItems: 'start' }}>
      <div className="panel" style={{ width: '100%', maxWidth: 1100 }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>Geri</button>
        <h2 style={{ marginTop: 8 }}>{lib?.name || 'Kütüphane'}</h2>
        <p className="muted">{lib?.description || 'Bu kütüphane için açıklama eklenmemiş.'}</p>
        <div className="rail" style={{ marginTop: 10 }}>
          {books.map(b => (
            <div key={b.id} className="tile small">
              {b.coverUrl ? <img className="tile-cover" src={b.coverUrl} /> : <div className="tile-cover placeholder" />}
              <div className="tile-body">
                <div className="tile-title line-1">{b.title || 'Adsız Kitap'}</div>
                <div className="tile-sub">{b.status || 'Taslak'}</div>
              </div>
            </div>
          ))}
          {books.length === 0 && <p className="muted">Bu kütüphanede henüz kitap yok.</p>}
        </div>
      </div>
    </div>
  )
}
