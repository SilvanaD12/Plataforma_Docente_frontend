import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProfile, register, signIn, signOut } from './authApi';

const profile = { name: 'Ana Pérez', email: 'ana@example.com' };
const session = { ...profile, token: 'token-de-prueba' };

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('API de autenticación', () => {
  it('inicia sesión sin enviar un token anterior', async () => {
    const fetchMock = mockFetch(Response.json(session));

    await expect(signIn(profile.email, 'clave-segura')).resolves.toEqual(session);

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/sessions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: profile.email, password: 'clave-segura' }),
    }));
    expect(fetchMock.mock.calls[0][1]?.headers).toBeInstanceOf(Headers);
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('crea una cuenta y devuelve su sesión', async () => {
    const fetchMock = mockFetch(Response.json(session, { status: 201 }));

    await expect(register(profile.name, profile.email, 'clave-segura')).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/accounts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ ...profile, password: 'clave-segura' }),
    }));
  });

  it('consulta el perfil con el token de la sesión', async () => {
    const fetchMock = mockFetch(Response.json(profile));

    await expect(getProfile(session.token)).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/sessions/current', expect.objectContaining({ method: 'GET' }));
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer ' + session.token);
  });

  it('cierra la sesión con el token y acepta la respuesta sin cuerpo', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    await expect(signOut(session.token)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/sessions/current', expect.objectContaining({ method: 'DELETE' }));
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer ' + session.token);
  });

  it('conserva el estado y el mensaje de error del backend', async () => {
    mockFetch(Response.json({ error: { message: 'La sesión venció.' } }, { status: 401 }));

    await expect(getProfile(session.token)).rejects.toMatchObject({
      status: 401,
      message: 'La sesión venció.',
    });
  });
});
