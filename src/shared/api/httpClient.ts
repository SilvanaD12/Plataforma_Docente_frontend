export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export interface ApiResponse<T> {
  status: number;
  data: T;
}

async function send<T>(
  path: string, method: string, body?: object, token?: string, extraHeaders?: Record<string, string>,
): Promise<ApiResponse<T>> {
  // Authorization y Content-Type se fijan después, para que una cabecera adicional no los reemplace.
  const headers = new Headers(extraHeaders);
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
  const data = response.status === 204 ? undefined as T : await response.json() as T;
  return { status: response.status, data };
}

export async function request<T>(
  path: string, method: string, body?: object, token?: string, headers?: Record<string, string>,
): Promise<T> {
  return (await send<T>(path, method, body, token, headers)).data;
}

/** Igual que `request`, pero conserva el código de estado (por ejemplo, para distinguir 202 de 200). */
export function requestWithStatus<T>(
  path: string, method: string, body?: object, token?: string, headers?: Record<string, string>,
): Promise<ApiResponse<T>> {
  return send<T>(path, method, body, token, headers);
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
}
