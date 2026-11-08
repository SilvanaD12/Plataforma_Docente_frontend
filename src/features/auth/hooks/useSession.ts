import { useCallback, useEffect, useState } from 'react';
import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import { getProfile, type Session } from '../api/authApi';
import { clearSessionToken, readSessionToken, saveSessionToken } from '../api/sessionStore';

export function useSession() {
  const [initialToken] = useState(readSessionToken);
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
          clearSessionToken(initialToken);
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
    saveSessionToken(nextSession.token);
    setSession(nextSession);
  }

  const closeSession = useCallback((token: string) => {
    clearSessionToken(token);
    setSession((current) => current?.token === token ? null : current);
  }, []);

  return { session, checking, restoreError, openSession, closeSession };
}
