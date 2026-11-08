import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/httpClient';
import { register, signIn, type Session } from '../api/authApi';
import { AuthShell } from '../components/AuthShell';

export function AuthPage({ creating, onSession }: { creating: boolean; onSession: (session: Session) => void }) {
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
