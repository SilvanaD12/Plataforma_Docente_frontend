/// <reference types="vite/client" />
import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { ApiError, errorMessage, getProfile, register, signIn, signOut, type Session } from './auth';
import { AuthShell } from './AuthShell';
import './tokens.css';
import './styles.css';

const tokenKey = 'plataforma5e.session';

function AuthForm({ creating, onSession }: { creating: boolean; onSession: (session: Session) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    if (creating && password !== data.get('confirmation')) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setError('');
    setPending(true);
    try {
      const session = creating
        ? await register(String(data.get('name')).trim(), email, password)
        : await signIn(email, password);
      onSession(session);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  const action = creating ? 'Crear cuenta' : 'Iniciar sesión';
  return (
    <AuthShell
      title={creating ? action : 'Inicio de sesión'}
      description={creating ? 'Regístrate para guardar tus cursos, tu material y tus recursos.' : 'Ingresa con tu cuenta de docente.'}
    >
      <form className="stack" onSubmit={submit}>
        {error && <p className="alert alert--warn" role="alert">{error}</p>}
        {creating && (
          <label className="field">
            <span className="field__label">Nombre y apellido</span>
            <input className="input" name="name" autoComplete="name" minLength={2} maxLength={100} required />
          </label>
        )}
        <label className="field">
          <span className="field__label">Correo electrónico</span>
          <input className="input" name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="field">
          <span className="field__label">Contraseña</span>
          <input className="input" name="password" type="password" autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 8 : 1} maxLength={200} aria-describedby={creating ? 'password-hint' : undefined} required />
        </label>
        {creating && (
          <>
            <p className="field__hint" id="password-hint">Al menos 8 caracteres.</p>
            <label className="field">
              <span className="field__label">Repite la contraseña</span>
              <input className="input" name="confirmation" type="password" autoComplete="new-password" maxLength={200} required />
            </label>
          </>
        )}
        <button className="btn btn--primary btn--block" aria-busy={pending} disabled={pending}>
          {pending ? 'Un momento…' : action}
        </button>
      </form>
      <p className="auth__switch">
        {creating ? <>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></> : <>¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link></>}
      </p>
    </AuthShell>
  );
}

function Workspace({ session, onClose }: { session: Session; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await signOut(session.token);
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onClose();
        return;
      }
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Cuenta docente">
        <p className="sidebar__brand">Plataforma Docente</p>
        <div className="sidebar__footer">
          <div className="sidebar__user"><strong>{session.name}</strong><span>{session.email}</span></div>
          <button className="sidebar__logout" type="button" disabled={pending} onClick={logout}>
            {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
      <main className="workspace stack" id="contenido">
        <h1>Tu espacio docente</h1>
        <p className="muted">Sesión iniciada como <strong>{session.name}</strong>.</p>
        {error && <p className="alert alert--warn" role="alert">{error}</p>}
      </main>
    </div>
  );
}

function App() {
  const [initialToken] = useState(() => sessionStorage.getItem(tokenKey));
  const [checking, setChecking] = useState(Boolean(initialToken));
  const [restoreError, setRestoreError] = useState('');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!initialToken) return;
    let active = true;

    getProfile(initialToken)
      .then((profile) => {
        if (active) setSession({ ...profile, token: initialToken });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          sessionStorage.removeItem(tokenKey);
        } else {
          setRestoreError(errorMessage(cause));
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => { active = false; };
  }, [initialToken]);

  function openSession(nextSession: Session) {
    sessionStorage.setItem(tokenKey, nextSession.token);
    setSession(nextSession);
  }

  function closeSession() {
    sessionStorage.removeItem(tokenKey);
    setSession(null);
  }

  return (
    <>
      {checking ? <AuthShell title="Tu sesión" description="Verificando tu acceso…"><p className="muted" role="status">Un momento…</p></AuthShell>
        : restoreError ? (
          <AuthShell title="No pudimos verificar tu sesión" description="Intenta conectar de nuevo con el servidor.">
            <p className="alert alert--warn" role="alert">{restoreError}</p>
            <button className="btn btn--primary" type="button" onClick={() => window.location.reload()}>Reintentar</button>
          </AuthShell>
        ) : (
          <Routes>
            <Route path="/login" element={session ? <Navigate to="/inicio" replace /> : <AuthForm key="login" creating={false} onSession={openSession} />} />
            <Route path="/registro" element={session ? <Navigate to="/inicio" replace /> : <AuthForm key="register" creating onSession={openSession} />} />
            <Route path="/inicio" element={session ? <Workspace session={session} onClose={closeSession} /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to={session ? '/inicio' : '/login'} replace />} />
          </Routes>
        )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
