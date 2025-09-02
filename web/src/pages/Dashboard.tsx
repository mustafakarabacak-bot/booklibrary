import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where, addDoc, serverTimestamp, getDocs, DocumentData, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [libs, setLibs] = useState<any[]>([])
  const [books, setBooks] = useState<any[]>([])
  const [openCreateLib, setOpenCreateLib] = useState(false)
  const [isEditingLib, setIsEditingLib] = useState(false)
  const [editingLibId, setEditingLibId] = useState<string | null>(null)
  const [libName, setLibName] = useState('')
  const [libDesc, setLibDesc] = useState('')
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [libActionsFor, setLibActionsFor] = useState<any | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)

  // Realtime fetch user's libraries
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'libraries'), where('ownerId', '==', user.uid), orderBy('updatedAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setLibs(arr as any[])
    })
    return () => unsub()
  }, [user])

  // Realtime fetch user's books
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'books'), where('ownerId', '==', user.uid), orderBy('updatedAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setBooks(arr as any[])
    })
    return () => unsub()
  }, [user])

  const toggleSelect = (id: string) => {
    setSelectedBookIds(prev => {
      const nxt = new Set(prev)
      if (nxt.has(id)) nxt.delete(id); else nxt.add(id)
      return nxt
    })
  }

  const onCreateLibrary = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!libName.trim()) return
    setSaving(true)
    try {
      const selected = books.filter(b => selectedBookIds.has(b.id))
      const coverUrl = selected[0]?.coverUrl || null
      if (isEditingLib && editingLibId) {
        await updateDoc(doc(db, 'libraries', editingLibId), {
          name: libName.trim(),
          description: libDesc.trim() || null,
          bookIds: Array.from(selectedBookIds),
          coverUrl,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'libraries'), {
          ownerId: user.uid,
          name: libName.trim(),
          description: libDesc.trim() || null,
          bookIds: Array.from(selectedBookIds),
          coverUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      setOpenCreateLib(false)
      setIsEditingLib(false)
      setEditingLibId(null)
      setLibName('')
      setLibDesc('')
      setSelectedBookIds(new Set())
    } finally {
      setSaving(false)
    }
  }

  const LibCard = ({ lib }: { lib: any }) => (
    <div className="tile" onClick={() => navigate(`/libraries/${lib.id}`)}>
      {lib.coverUrl ? (
        <img className="tile-cover" src={lib.coverUrl} alt={lib.name} />
      ) : (
        <div className="tile-cover placeholder" />
      )}
      <div className="tile-body tile-body-row">
        <div className="tile-info">
          <div className="tile-title">{lib.name}</div>
          <div className="tile-sub">{Array.isArray(lib.bookIds) ? lib.bookIds.length : 0} kitap</div>
        </div>
        <button className="menu-btn" title="Seçenekler" onClick={(e) => { e.stopPropagation(); setLibActionsFor(lib); }}>
          ⋯
        </button>
      </div>
    </div>
  )

  const BookCard = ({ book }: { book: any }) => (
    <button className="tile small" onClick={() => navigate(`/books/${book.id}`)}>
      {book.coverUrl ? (
        <img className="tile-cover" src={book.coverUrl} alt={book.title} />
      ) : (
        <div className="tile-cover placeholder" />
      )}
      <div className="tile-body">
        <div className="tile-title line-1">{book.title || 'Adsız Kitap'}</div>
        <div className="tile-sub">{book.status || 'Taslak'}</div>
      </div>
    </button>
  )

  return (
    <div className="grid-center" style={{ alignItems: 'start' }}>
      <div className="panel" style={{ width: '100%', maxWidth: 1100 }}>
        <h2 style={{ marginTop: 0 }}>Merhaba, <span style={{ fontWeight: 600 }}>{user?.displayName || user?.email}</span></h2>

        {/* Kütüphaneler satırı */}
        <div className="row-header">
          <h3>Kütüphaneler</h3>
        </div>
        <div className="rail">
          <button className="plus-vert" onClick={() => setOpenCreateLib(true)}>
            <span className="plus">+</span>
            <span>Kütüphane Oluştur</span>
          </button>
          {libs.map((lib) => (
            <LibCard key={lib.id} lib={lib} />
          ))}
        </div>

        {/* Kitaplar satırı */}
        <div className="row-header" style={{ marginTop: 20 }}>
          <h3>Kitaplar</h3>
        </div>
        <div className="rail">
          <Link to="/books/new" className="plus-vert">
            <span className="plus">+</span>
            <span>Kitap Oluştur</span>
          </Link>
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </div>

  {openCreateLib && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 760 }}>
    <h3 style={{ marginTop: 0 }}>{isEditingLib ? 'Kütüphaneyi Düzenle' : 'Kütüphane Oluştur'}</h3>
            <form className="form" onSubmit={onCreateLibrary}>
              <label>
                İsim
                <input className="input" value={libName} onChange={(e) => setLibName(e.target.value)} placeholder="Kütüphane adı" />
              </label>
              <label>
                Açıklama
                <textarea className="input" rows={3} value={libDesc} onChange={(e) => setLibDesc(e.target.value)} placeholder="Kısa açıklama" />
              </label>
              <div className="divider">Kitaplarını ekle</div>
              {books.length === 0 ? (
                <p className="muted">Henüz hiç kitabın yok. Önce bir kitap oluştur.</p>
              ) : (
                <div className="grid-books">
                  {books.map((bk) => (
                    <label key={bk.id} className={`book-pick ${selectedBookIds.has(bk.id) ? 'is-selected' : ''}`}>
                      {bk.coverUrl ? (
                        <img src={bk.coverUrl} alt={bk.title} />
                      ) : (
                        <div className="tile-cover placeholder" />
                      )}
                      <div className="name">{bk.title || 'Adsız'}</div>
                      <input type="checkbox" checked={selectedBookIds.has(bk.id)} onChange={() => toggleSelect(bk.id)} />
                    </label>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setOpenCreateLib(false); setIsEditingLib(false); setEditingLibId(null); }}>Vazgeç</button>
                <button className="btn" disabled={saving || !libName.trim()} type="submit">{isEditingLib ? 'Kaydet' : 'Oluştur'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {libActionsFor && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setLibActionsFor(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Kütüphane Seçenekleri</h3>
            <p className="muted" style={{ marginBottom: 10 }}>{libActionsFor.name}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button className="btn" onClick={() => {
                // Düzenleme akışını başlat
                setLibName(libActionsFor.name || '')
                setLibDesc(libActionsFor.description || '')
                setSelectedBookIds(new Set(Array.isArray(libActionsFor.bookIds) ? libActionsFor.bookIds : []))
                setIsEditingLib(true)
                setEditingLibId(libActionsFor.id)
                setLibActionsFor(null)
                setOpenCreateLib(true)
              }}>Düzenle</button>
              <button className="btn btn-ghost" onClick={() => {
                setConfirmDelete(libActionsFor)
                setLibActionsFor(null)
              }}>Sil</button>
              <button className="btn btn-ghost" onClick={() => setLibActionsFor(null)}>Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Kütüphane silinsin mi?</h3>
            <p className="muted">“{confirmDelete.name}” kütüphanesini silmek üzeresiniz. Bu işlem geri alınamaz.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Vazgeç</button>
              <button className="btn" onClick={async () => {
                try { await deleteDoc(doc(db, 'libraries', confirmDelete.id)) } catch {}
                setConfirmDelete(null)
              }}>Evet, sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
