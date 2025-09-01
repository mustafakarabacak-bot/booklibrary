import React from 'react'
import { Link } from 'react-router-dom'

export default function CreatePasswordEmailSent() {
  return (
    <div className="auth-center">
      <div className="flip-scene">
        <div className="auth-logo-over">
          <img src="/logo.png" alt="BookLibrary" className="auth-logo" />
        </div>
        <div className="card card-sharp">
          <div className="auth-header">
            <h2>Mailini Kontrol Et</h2>
            <p className="lead">Şifreni oluşturman için bir bağlantı gönderdik. Gelen kutusu ve spam klasörünü kontrol et.</p>
          </div>
          <div className="card-actions">
            <Link className="btn" to="/login">Girişe Dön</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
