const tokenKey = 'plataforma5e.session';

function read(storage: 'localStorage' | 'sessionStorage') {
  try {
    return window[storage].getItem(tokenKey);
  } catch {
    return null;
  }
}

export function readSessionToken() {
  const persisted = read('localStorage');
  const previous = read('sessionStorage');
  if (previous) saveSessionToken(persisted ?? previous);
  return persisted ?? previous;
}

export function saveSessionToken(token: string) {
  try {
    window.localStorage.setItem(tokenKey, token);
  } catch {
    try {
      window.sessionStorage.setItem(tokenKey, token);
    } catch {
      // React conserva la sesión en memoria si el navegador bloquea el almacenamiento.
    }
    return;
  }

  try {
    window.sessionStorage.removeItem(tokenKey);
  } catch {
    // La copia persistente ya se guardó.
  }
}

export function clearSessionToken(token: string) {
  for (const storage of ['localStorage', 'sessionStorage'] as const) {
    try {
      if (window[storage].getItem(tokenKey) === token) {
        window[storage].removeItem(tokenKey);
      }
    } catch {
      // El servidor ya invalidó el token o rechazó su uso.
    }
  }
}
