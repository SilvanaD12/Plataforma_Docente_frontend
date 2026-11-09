import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { signOut, type Session } from '../features/auth/api/authApi';
import { ApiError, errorMessage } from '../shared/api/httpClient';

export function TeacherWorkspace({ session, onClose }: { session: Session; onClose: (token: string) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await signOut(session.token);
      onClose(session.token);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onClose(session.token);
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
        <nav aria-label="Navegación docente">
          <NavLink className="nav-link" to="/courses">Mis cursos</NavLink>
          <NavLink className="nav-link" to="/downloads">Mis descargas</NavLink>
        </nav>
        <div className="sidebar__footer">
          <div className="sidebar__user"><strong>{session.name}</strong><span>{session.email}</span></div>
          <button className="sidebar__logout" type="button" disabled={pending} onClick={logout}>
            {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
      <main className="workspace stack" id="contenido">
        {error && <p className="alert alert--warn" role="alert">{error}</p>}
        <Outlet />
      </main>
    </div>
  );
}
