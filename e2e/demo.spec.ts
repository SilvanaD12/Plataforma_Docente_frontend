import { expect, test } from '@playwright/test';
import resourceTypes from './fixtures/resource-types.json' with { type: 'json' };
import { COURSE, UNIT, TEACHER, mockApi, signIn } from './support/mockApi';

/**
 * TA-002: recorrido de la demo en el navegador, sin backend real. Las respuestas de la API se simulan en
 * support/mockApi.ts a partir de docs/api/openapi.json del backend.
 */

const unitPath = `/courses/${COURSE.id}/units/${UNIT.id}`;

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('un inicio de sesión con datos incorrectos muestra el error y no entra', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(TEACHER.email);
  await page.getByLabel('Contraseña').fill('otra-clave');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
  await expect(page).toHaveURL(/\/login$/);
});

test('inicia sesión, entra a la unidad y recorre Material, Generación, Revisión y Exportación', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Mis cursos' })).toBeVisible();

  await page.getByRole('link', { name: 'Entrar al curso' }).click();
  await expect(page.getByRole('heading', { level: 1, name: COURSE.name })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir unidad' }).click();
  await expect(page).toHaveURL(new RegExp(`${unitPath}$`));
  await expect(page.getByRole('heading', { level: 1, name: UNIT.title })).toBeVisible();

  const tabs = page.getByRole('navigation', { name: 'Secciones de la unidad' });

  await tabs.getByRole('link', { name: 'Material' }).click();
  await expect(page).toHaveURL(new RegExp(`${unitPath}/material$`));
  await expect(page.getByText('Esta unidad todavía no tiene materiales registrados.')).toBeVisible();

  await tabs.getByRole('link', { name: 'Generación' }).click();
  await expect(page).toHaveURL(new RegExp(`${unitPath}/generation$`));
  await expect(page.getByRole('heading', { name: 'Nueva generación' })).toBeVisible();

  await tabs.getByRole('link', { name: 'Revisión' }).click();
  await expect(page).toHaveURL(new RegExp(`${unitPath}/review$`));
  await expect(page.getByText('Esta unidad todavía no tiene recursos para revisar.', { exact: false })).toBeVisible();

  await tabs.getByRole('link', { name: 'Exportación' }).click();
  await expect(page).toHaveURL(new RegExp(`${unitPath}/export$`));
  await expect(page.getByRole('heading', { level: 2, name: 'Exportación' })).toBeVisible();
});

test('el selector de modalidad muestra solo los tipos compatibles', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Mis cursos' })).toBeVisible();
  await page.goto(`${unitPath}/generation`);

  const modality = page.getByLabel('Modalidad');
  const shownTypes = page.locator('input[name="resourceTypes"]');
  const expectedFor = (name: string) =>
    resourceTypes.filter((type) => type.modalities.includes(name)).map((type) => type.id).sort();

  for (const name of ['Textual', 'Gamificado', 'Multimedia', 'Kinestésico']) {
    await modality.selectOption(name);
    await expect(shownTypes).toHaveCount(expectedFor(name).length);
    const values = await shownTypes.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect(values.sort(), name).toEqual(expectedFor(name));
  }
  // Kinestésico tiene un solo tipo: la actividad kinestésica.
  await expect(page.getByText('Actividad kinestésica')).toBeVisible();
});

test('en Exportación, sin recursos aprobados se ve el aviso de NO_APPROVED_RESOURCES con su motivo', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Mis cursos' })).toBeVisible();
  await page.goto(`${unitPath}/export`);

  await page.getByRole('button', { name: 'Descargar .xml' }).click();

  const notice = page.getByRole('alert');
  await expect(notice).toContainText('Ningún recurso cumple las condiciones para exportar');
  await expect(notice).toContainText('2 recursos sin aprobar');
});
