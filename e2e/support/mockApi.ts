import type { Page, Route } from '@playwright/test';
import resourceTypes from '../fixtures/resource-types.json' with { type: 'json' };

/**
 * Respuestas simuladas de la API para los recorridos de TA-002. Las formas siguen docs/api/openapi.json del backend
 * (SessionResponse, CourseResponse, ResourceTypeResponse, ErrorResponse…); el catálogo de tipos es la respuesta real
 * de GET /api/v1/resource-types. No hay backend real ni credenciales: el token es un valor de prueba.
 */

export const TEACHER = { name: 'Docente de prueba', email: 'docente@example.com' };
export const PASSWORD = 'clave-de-prueba';
const TOKEN = 'token-de-prueba';

export const UNIT = {
  id: 'unidad-1',
  courseId: 'curso-1',
  number: 1,
  title: 'Capa de transporte',
  outcomes: [{ id: 'ra-1', code: 'RA1', text: 'Distingue TCP y UDP' }],
};
export const COURSE = {
  id: 'curso-1',
  code: 'RED-301',
  name: 'Redes de computadoras',
  term: '2026-II',
  summary: null,
  learningGoal: null,
  units: [UNIT],
};

const NO_APPROVED_MESSAGE =
  'Ningún recurso cumple las condiciones para exportar: aprobado, con comprobación vigente y compatible con el formato.';

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function error(route: Route, status: number, code: string, message: string, details?: unknown) {
  return json(route, status, { error: { code, message, ...(details === undefined ? {} : { details }) } });
}

/** Intercepta /api/v1/** con una unidad sin material, sin recursos y sin descargas. */
export async function mockApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const path = pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    const authorized = request.headers()['authorization'] === `Bearer ${TOKEN}`;

    if (path === '/sessions' && method === 'POST') {
      const { email, password } = request.postDataJSON() as { email: string; password: string };
      return email === TEACHER.email && password === PASSWORD
        ? json(route, 200, { ...TEACHER, token: TOKEN })
        : error(route, 401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    }
    if (path === '/resource-types' && method === 'GET') return json(route, 200, resourceTypes);
    if (!authorized) return error(route, 401, 'SESSION_REQUIRED', 'Inicia sesión con el backend.');

    if (path === '/sessions/current' && method === 'GET') return json(route, 200, TEACHER);
    if (path === '/sessions/current' && method === 'DELETE') return route.fulfill({ status: 204 });
    if (path === '/courses' && method === 'GET') return json(route, 200, [COURSE]);
    if (path === '/documents' && method === 'GET') return json(route, 200, []);
    if (path === '/generation-requests' && method === 'GET') return json(route, 200, []);
    if (path === `/units/${UNIT.id}/resources` && method === 'GET') return json(route, 200, []);
    if (path === '/downloads' && method === 'GET') return json(route, 200, []);
    if (path === `/units/${UNIT.id}/exports` && method === 'POST') {
      return error(route, 422, 'NO_APPROVED_RESOURCES', NO_APPROVED_MESSAGE, [{ reason: 'not_approved', count: 2 }]);
    }
    return error(route, 404, 'NOT_MOCKED', `Ruta no simulada en la prueba: ${method} ${path}`);
  });
}

/** Inicia sesión desde la pantalla de ingreso. */
export async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(TEACHER.email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
