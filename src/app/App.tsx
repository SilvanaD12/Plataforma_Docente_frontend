import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthShell } from '../features/auth/components/AuthShell';
import { useSession } from '../features/auth/hooks/useSession';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { TeacherWorkspace } from './TeacherWorkspace';

export function App() {
  const { session, checking, restoreError, openSession, closeSession } = useSession();

  if (checking) {
    return (
      <AuthShell title="Tu sesión" description="Verificando tu acceso…">
        <p className="muted" role="status">Un momento…</p>
      </AuthShell>
    );
  }

  if (restoreError) {
    return (
      <AuthShell title="No pudimos verificar tu sesión" description="Intenta conectar de nuevo con el servidor.">
        <p className="alert alert--warn" role="alert">{restoreError}</p>
        <button className="btn btn--primary" type="button" onClick={() => window.location.reload()}>Reintentar</button>
      </AuthShell>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/inicio" replace /> : <AuthPage key="login" creating={false} onSession={openSession} />} />
      <Route path="/registro" element={session ? <Navigate to="/inicio" replace /> : <AuthPage key="register" creating onSession={openSession} />} />
      <Route path="/inicio" element={session ? <TeacherWorkspace session={session} onClose={closeSession} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={session ? '/inicio' : '/login'} replace />} />
    </Routes>
  );
}
