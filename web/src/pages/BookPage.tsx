import React from 'react'
import { useParams } from 'react-router-dom'

export default function BookPage() {
  const { id } = useParams()
  return (
    <div className="grid-center" style={{ alignItems: 'start' }}>
      <div className="panel" style={{ width: '100%', maxWidth: 900 }}>
        <h2 style={{ marginTop: 0 }}>Kitap</h2>
        <p className="muted">Kitap düzenleyici burada olacak. ID: <strong>{id}</strong></p>
      </div>
    </div>
  )
}
