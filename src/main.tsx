/// <reference types="vite/client" />
import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { ApiError, errorMessage, getProfile, register, signIn, signOut, type Session } from './auth';
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

  const title = creating ? 'Crear cuenta' : 'Iniciar sesión';
  return (
    <section className="panel" aria-labelledby="form-title">
      <h1 id="form-title">{title}</h1>
      <p>{creating ? 'Registra tu cuenta docente para acceder a tu espacio.' : 'Accede a tu espacio docente.'}</p>
      <form onSubmit={submit}>
        {creating && <label>Nombre completo<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>}
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label>
          Contraseña
          <input name="password" type="password" autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 8 : 1} maxLength={200} required />
          {creating && <small>Usa al menos 8 caracteres.</small>}
        </label>
        {creating && <label>Confirmar contraseña<input name="confirmation" type="password" autoComplete="new-password" required /></label>}
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={pending}>{pending ? 'Un momento…' : title}</button>
      </form>
      <p className="alternate">
        {creating ? <>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></> : <>¿Todavía no tienes cuenta? <Link to="/registro">Regístrate</Link></>}
      </p>
    </section>
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
    <section className="panel" aria-labelledby="workspace-title">
      <h1 id="workspace-title">Tu espacio docente</h1>
      <p>Sesión iniciada como <strong>{session.name}</strong>.</p>
      <p className="email">{session.email}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" disabled={pending} onClick={logout}>{pending ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
    </section>
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
    <main className="layout">
      <header className="brand"><span aria-hidden="true">5E</span> Plataforma Docente</header>
      {checking ? <p className="panel" role="status">Verificando tu sesión…</p>
        : restoreError ? (
          <section className="panel">
            <h1>No pudimos verificar tu sesión</h1>
            <p className="error" role="alert">{restoreError}</p>
            <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
          </section>
        ) : (
          <Routes>
            <Route path="/login" element={session ? <Navigate to="/inicio" replace /> : <AuthForm key="login" creating={false} onSession={openSession} />} />
            <Route path="/registro" element={session ? <Navigate to="/inicio" replace /> : <AuthForm key="register" creating onSession={openSession} />} />
            <Route path="/inicio" element={session ? <Workspace session={session} onClose={closeSession} /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to={session ? '/inicio' : '/login'} replace />} />
          </Routes>
        )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
