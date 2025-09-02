import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Login from './Login'
import Register from './Register'

export default function AuthFlip({ mode }: { mode: 'login' | 'register' }) {
  const opposite = mode === 'login' ? 'register' : 'login'
  useEffect(() => {
    // arkaplan görselini sadece bu görünümde aktif et
    document.body.classList.add('auth-bg-ready')
    return () => { document.body.classList.remove('auth-bg-ready') }
  }, [])
  return (
    <div className="auth-center">
      <div className="flip-scene">
        <div className="auth-logo-over">
          <img src="/logo.png" alt="BookLibrary" className="auth-logo" />
        </div>
        <div className={`flip-card ${mode === 'register' ? 'is-flipped' : ''}`}>
          <div className="flip-face flip-front">
            <div className="card card-sharp">
              <Login embedded />
            </div>
          </div>
          <div className="flip-face flip-back">
            <div className="card card-sharp">
              <Register embedded />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
