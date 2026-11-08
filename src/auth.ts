export interface Profile {
  name: string;
  email: string;
}

export interface Session extends Profile {
  token: string;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function request<T>(path: string, method: string, body?: object, token?: string): Promise<T> {
  const headers = new Headers();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (body) headers.set('Content-Type', 'application/json');

  const response = await fetch(apiBase + '/api/v1' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = typeof data?.error?.message === 'string'
      ? data.error.message
      : 'No se pudo completar la solicitud. Inténtalo de nuevo.';
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function signIn(email: string, password: string) {
  return request<Session>('/sessions', 'POST', { email, password });
}

export function register(name: string, email: string, password: string) {
  return request<Session>('/accounts', 'POST', { name, email, password });
}

export function getProfile(token: string) {
  return request<Profile>('/sessions/current', 'GET', undefined, token);
}

export function signOut(token: string) {
  return request<void>('/sessions/current', 'DELETE', undefined, token);
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
}
