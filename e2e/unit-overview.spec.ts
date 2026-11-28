import { expect, test } from '@playwright/test';
import { COURSE, UNIT, mockApi, signIn } from './support/mockApi';

const overview = `/courses/${COURSE.id}/units/${UNIT.id}`;
const resourcesPath = `**/api/v1/units/${UNIT.id}/resources`;

const scenarios = [
  { materials: [], resources: [], counts: ['0 (0 procesados)', '0', '0'], label: 'Añadir material', route: 'material' },
  { materials: ['pendiente'], resources: [], counts: ['1 (0 procesados)', '0', '0'], label: 'Procesar material', route: 'material' },
  { materials: ['procesado'], resources: ['descartado'], counts: ['1 (1 procesado)', '0', '0'], label: 'Ir a Generación', route: 'generation' },
  { materials: ['procesado', 'pendiente'], resources: ['aprobado', 'pendiente'], counts: ['2 (1 procesado)', '1', '1'], label: 'Revisar recursos pendientes', route: 'review' },
  { materials: ['procesado'], resources: ['aprobado'], counts: ['1 (1 procesado)', '0', '1'], label: 'Ver opciones de exportación', route: 'export' },
];

for (const scenario of scenarios) {
  test(`Resumen sugiere «${scenario.label}» según el progreso`, async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/v1/documents', (route) => route.fulfill({ json: [
      { unitId: 'otra-unidad', status: 'procesado' },
      ...scenario.materials.map((status) => ({ unitId: UNIT.id, status })),
    ] }));
    await page.route(resourcesPath, (route) => route.fulfill({
      json: scenario.resources.map((status) => ({ status })),
    }));
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();
    await page.goto(overview);
    const progress = page.getByRole('region', { name: 'Progreso de la unidad' });
    await expect(progress.locator('dd')).toHaveText(scenario.counts);
    await expect(progress.getByRole('link', { name: scenario.label })).toHaveAttribute('href', `${overview}/${scenario.route}`);
    await expect(page.getByText(UNIT.outcomes[0].text, { exact: false })).toBeVisible();
  });
}

test('Resumen permite reintentar si falla la consulta', async ({ page }) => {
  await mockApi(page);
  await page.route(resourcesPath, (route) => route.fulfill({ status: 503 }), { times: 1 });
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();
  await page.goto(overview);

  const progress = page.getByRole('region', { name: 'Progreso de la unidad' });
  await expect(progress.getByRole('alert')).toHaveText('No se pudo consultar el progreso de la unidad.');
  await expect(progress.locator('dd')).toHaveCount(0);
  await progress.getByRole('button', { name: 'Reintentar' }).click();
  await expect(progress.getByRole('link', { name: 'Añadir material' })).toBeVisible();
});
