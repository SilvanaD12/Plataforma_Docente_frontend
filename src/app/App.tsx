import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthShell } from '../features/auth/components/AuthShell';
import { useSession } from '../features/auth/hooks/useSession';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { CourseFormPage } from '../features/courses/pages/CourseFormPage';
import { CourseDetailPage } from '../features/courses/pages/CourseDetailPage';
import { CourseListPage } from '../features/courses/pages/CourseListPage';
import { CoursesLayout } from '../features/courses/pages/CoursesLayout';
import { DownloadsPage } from '../features/export/pages/DownloadsPage';
import { ExportPage } from '../features/export/pages/ExportPage';
import { GenerationPage } from '../features/generation/pages/GenerationPage';
import { MaterialPage } from '../features/materials/pages/MaterialPage';
import { ReviewPage } from '../features/review/pages/ReviewPage';
import { UnitLayout } from '../features/units/pages/UnitLayout';
import { UnitOverviewPage } from '../features/units/pages/UnitOverviewPage';
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
      <Route path="/login" element={session ? <Navigate to="/courses" replace /> : <AuthPage key="login" creating={false} onSession={openSession} />} />
      <Route path="/registro" element={session ? <Navigate to="/courses" replace /> : <AuthPage key="register" creating onSession={openSession} />} />
      <Route element={session ? <TeacherWorkspace session={session} onClose={closeSession} /> : <Navigate to="/login" replace />}>
        <Route path="/courses" element={session && <CoursesLayout key={session.token} token={session.token} onSessionExpired={closeSession} />}>
          <Route index element={<CourseListPage />} />
          <Route path="new" element={<CourseFormPage />} />
          <Route path=":courseId" element={<CourseDetailPage />} />
          <Route path=":courseId/edit" element={<CourseFormPage />} />
          <Route path=":courseId/units/:unitId" element={<UnitLayout />}>
            <Route index element={<UnitOverviewPage />} />
            <Route path="material" element={<MaterialPage />} />
            <Route path="generation" element={<GenerationPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="export" element={<ExportPage />} />
          </Route>
        </Route>
        {/* REV-C9: el historial del docente no depende de ningún curso; se ve aunque la lista de cursos esté vacía. */}
        <Route path="/downloads" element={session && <DownloadsPage key={session.token} token={session.token} onSessionExpired={closeSession} />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? '/courses' : '/login'} replace />} />
    </Routes>
  );
}
