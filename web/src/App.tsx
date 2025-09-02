import React, { useMemo, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthFlip from './pages/AuthFlip'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './auth/ProtectedRoute'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import CreatePasswordEmailSent from './pages/CreatePasswordEmailSent'
import { useAuth } from './auth/AuthContext'
import { auth } from './firebase'
import { signOut } from 'firebase/auth'
import Profile from './pages/Profile'
import NewBook from './pages/NewBook'
import LibraryPage from './pages/LibraryPage'
import BookPage from './pages/BookPage'
import Writer from './pages/Writer'

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const hideHeader = ['/login','/register','/forgot-password','/reset-password','/verify-email','/create-password-email-sent'].includes(location.pathname);
  const isAuthPage = hideHeader;
  const initials = useMemo(() => {
    if (!user) return '';
    const name = user.displayName || user.email || '';
    const parts = name.split(/[\s@._-]+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const second = parts[1]?.charAt(0) || '';
    return (first + second).toUpperCase();
  }, [user]);
  const onConfirmLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutConfirm(false);
      navigate('/login');
    } catch (e) {
      setShowLogoutConfirm(false);
    }
  };
  
  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<AuthFlip mode="login" />} />
        <Route path="/register" element={<AuthFlip mode="register" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
  <Route path="/verify-email" element={<VerifyEmail />} />
  <Route path="/create-password-email-sent" element={<CreatePasswordEmailSent />} />
      </Routes>
    );
  }
  
  return (
    <div className="container">
      <header className="header">
        <Link to="/" className="brand" title="Dashboard'a dön">
          <img className="logo" src="/logo.png" alt="logo" />
          <h1>BookLibrary</h1>
        </Link>
        <div className="header-actions">
          <button
            className="avatar-btn"
            title="Profil"
            onClick={() => navigate('/profile')}
          >
            {user?.photoURL ? (
              <img className="avatar" src={user.photoURL} alt={user.displayName || user.email || 'Kullanıcı'} />
            ) : (
              <div className="avatar avatar-fallback">{initials || 'K'}</div>
            )}
          </button>
          {user && (
            <button className="btn btn-ghost" onClick={() => setShowLogoutConfirm(true)}>Çıkış Yap</button>
          )}
        </div>
      </header>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/books/new"
          element={
            <ProtectedRoute>
              <NewBook />
            </ProtectedRoute>
          }
        />
        <Route
          path="/libraries/:id"
          element={
            <ProtectedRoute>
              <LibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/books/:id"
          element={
            <ProtectedRoute>
              <BookPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/books/:id/write"
          element={
            <ProtectedRoute>
              <Writer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>

      {showLogoutConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3 style={{ marginTop: 0 }}>Çıkış yapılsın mı?</h3>
            <p className="muted">Hesabınızdan çıkış yapmak üzeresiniz. Emin misiniz?</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>Vazgeç</button>
              <button className="btn" onClick={onConfirmLogout}>Evet, çıkış yap</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
