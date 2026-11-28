import { expect, test } from '@playwright/test';
import { COURSE, UNIT, mockApi, signIn } from './support/mockApi';

const secondUnit = { ...UNIT, id: 'unidad-2', title: 'Dispositivos', number: 2, outcomes: [] };
const course = { ...COURSE, units: [UNIT, secondUnit] };

test('envía la unidad retirada y omite los resultados retirados al guardar', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/courses', (route) => route.fulfill({ json: [course] }));
  await page.route(`**/api/v1/courses/${course.id}`, (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      removedUnitIds: [secondUnit.id],
      units: [{ id: UNIT.id, title: UNIT.title, outcomes: [] }],
    });
    return route.fulfill({ json: { ...course, units: [{ ...UNIT, outcomes: [] }] } });
  });
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();
  await page.goto(`/courses/${course.id}/edit`);
  await page.getByRole('group', { name: 'Unidad 2' }).getByRole('button', { name: 'Quitar unidad' }).click();
  await expect(page.getByRole('button', { name: 'Quitar unidad' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Quitar resultado 1' }).click();
  await page.getByRole('button', { name: 'Guardar curso' }).click();
  await expect(page).toHaveURL(new RegExp(`/courses/${course.id}$`));
});

test('muestra los vínculos y deshace los retiros sin perder lo editado', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/courses', (route) => route.fulfill({ json: [course] }));
  await page.route(`**/api/v1/courses/${course.id}`, (route) => route.fulfill({
    status: 409,
    json: { error: {
      code: 'COURSE_REMOVAL_BLOCKED',
      message: 'No se pueden quitar unidades o resultados con datos vinculados.',
      details: [
        { unitId: UNIT.id, outcomeId: UNIT.outcomes[0].id, links: ['materials', 'plans'] },
        { unitId: secondUnit.id, links: ['requests', 'resources'] },
      ],
    } },
  }));
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();
  await page.goto(`/courses/${course.id}/edit`);

  const text = page.getByLabel('Resultado de aprendizaje 1', { exact: true });
  await text.fill('Distingue TCP, UDP e IP');
  await page.getByRole('button', { name: 'Quitar resultado 1' }).click();
  await page.getByRole('group', { name: 'Unidad 2' }).getByRole('button', { name: 'Quitar unidad' }).click();
  await page.getByRole('button', { name: 'Guardar curso' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('«Distingue TCP y UDP» (unidad «Capa de transporte»): materiales, planes de generación.');
  await expect(alert).toContainText('Unidad «Dispositivos»: pedidos de generación, recursos.');
  await page.getByRole('button', { name: 'Deshacer retiros' }).click();
  await expect(text).toHaveValue('Distingue TCP, UDP e IP');
  await expect(page.getByRole('group', { name: 'Unidad 2' })).toBeVisible();
  await expect(alert).toHaveCount(0);
});
