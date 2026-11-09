export class ApiError extends Error {
  /** `code` y `details` vienen de `error.code` y `error.details` de la API, si la respuesta los trae. */
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export interface ApiResponse<T> {
  status: number;
  data: T;
}

function fetchApi(
  path: string, method: string, body?: object, token?: string, extraHeaders?: Record<string, string>,
): Promise<Response> {
  // Authorization y Content-Type se fijan después, para que una cabecera adicional no los reemplace.
  const headers = new Headers(extraHeaders);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (body) headers.set('Content-Type', 'application/json');

  return fetch(apiBase + '/api/v1' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function apiError(response: Response): Promise<ApiError> {
  const data = await response.json().catch(() => null);
  const message = typeof data?.error?.message === 'string'
    ? data.error.message
    : 'No se pudo completar la solicitud. Inténtalo de nuevo.';
  const code = typeof data?.error?.code === 'string' ? data.error.code : undefined;
  return new ApiError(response.status, message, code, data?.error?.details);
}

async function send<T>(
  path: string, method: string, body?: object, token?: string, extraHeaders?: Record<string, string>,
): Promise<ApiResponse<T>> {
  const response = await fetchApi(path, method, body, token, extraHeaders);
  if (!response.ok) throw await apiError(response);
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

export interface DownloadedFile {
  blob: Blob;
  /** Nombre que da el servidor en `Content-Disposition`; null si no lo manda. */
  fileName: string | null;
}

function fileNameFrom(contentDisposition: string | null): string | null {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : null;
}

/** POST que devuelve un archivo (por ejemplo, una exportación). Los errores se leen igual que en `request`. */
export async function requestFile(path: string, body: object, token: string): Promise<DownloadedFile> {
  const response = await fetchApi(path, 'POST', body, token);
  if (!response.ok) throw await apiError(response);
  return { blob: await response.blob(), fileName: fileNameFrom(response.headers.get('Content-Disposition')) };
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
}
