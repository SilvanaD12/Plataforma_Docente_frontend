import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionToken, readSessionToken, saveSessionToken } from './sessionStore';

const tokenKey = 'plataforma5e.session';

function storage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
}

let localStorage: ReturnType<typeof storage>;
let sessionStorage: ReturnType<typeof storage>;

beforeEach(() => {
  localStorage = storage();
  sessionStorage = storage();
  vi.stubGlobal('window', { localStorage, sessionStorage });
});

afterEach(() => vi.unstubAllGlobals());

describe('almacenamiento de sesión', () => {
  it('persiste el token fuera de la pestaña que inició sesión', () => {
    saveSessionToken('token-nuevo');

    expect(localStorage.getItem(tokenKey)).toBe('token-nuevo');
    expect(sessionStorage.getItem(tokenKey)).toBeNull();
    expect(readSessionToken()).toBe('token-nuevo');
  });

  it('migra el token de una pestaña abierta antes de la actualización', () => {
    sessionStorage.setItem(tokenKey, 'token-anterior');

    expect(readSessionToken()).toBe('token-anterior');
    expect(localStorage.getItem(tokenKey)).toBe('token-anterior');
    expect(sessionStorage.getItem(tokenKey)).toBeNull();
  });

  it('usa el almacenamiento de la pestaña si el persistente está bloqueado', () => {
    vi.stubGlobal('window', {
      get localStorage() { throw new Error('Almacenamiento bloqueado'); },
      sessionStorage,
    });

    saveSessionToken('token-temporal');

    expect(sessionStorage.getItem(tokenKey)).toBe('token-temporal');
    expect(readSessionToken()).toBe('token-temporal');
  });

  it('prioriza la sesión persistente y retira una copia antigua de la pestaña', () => {
    localStorage.setItem(tokenKey, 'token-persistente');
    sessionStorage.setItem(tokenKey, 'token-anterior');

    expect(readSessionToken()).toBe('token-persistente');
    expect(sessionStorage.getItem(tokenKey)).toBeNull();
  });

  it('conserva un token más reciente al limpiar el de una sesión anterior', () => {
    localStorage.setItem(tokenKey, 'token-nuevo');
    sessionStorage.setItem(tokenKey, 'token-anterior');

    clearSessionToken('token-anterior');

    expect(localStorage.getItem(tokenKey)).toBe('token-nuevo');
    expect(sessionStorage.getItem(tokenKey)).toBeNull();
    clearSessionToken('token-nuevo');
    expect(readSessionToken()).toBeNull();
  });
});
