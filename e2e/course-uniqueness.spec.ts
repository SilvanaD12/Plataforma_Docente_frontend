import { expect, test } from '@playwright/test';
import { COURSE, UNIT, mockApi, signIn } from './support/mockApi';

const scenarios = [
  {
    name: 'marca el titulo repetido de una unidad nueva',
    code: 'DUPLICATE_UNIT_TITLE',
    detail: { field: 'title', unitIndex: 1 },
    input: 'title-2',
    value: UNIT.title,
  },
  {
    name: 'marca el cuadro del resultado nuevo cuando su codigo se repite',
    code: 'DUPLICATE_OUTCOME',
    detail: { field: 'code', unitIndex: 1, outcomeIndex: 0 },
    input: 'outcomes-2',
    value: 'RA1: Identifica un router',
  },
  {
    name: 'marca el texto duplicado de un resultado guardado',
    code: 'DUPLICATE_OUTCOME',
    detail: { field: 'text', unitIndex: 0, outcomeIndex: 0 },
    input: 'outcome-text-1-0',
    value: UNIT.outcomes[0].text,
  },
  {
    name: 'marca el cuadro de un resultado nuevo con texto duplicado',
    code: 'DUPLICATE_OUTCOME',
    detail: { field: 'text', unitIndex: 1, outcomeIndex: 0 },
    input: 'outcomes-2',
    value: `RA2: ${UNIT.outcomes[0].text}`,
  },
];

for (const scenario of scenarios) {
  test(`CUR-A ${scenario.name}`, async ({ page }) => {
    const message = 'Ya existe un valor igual en este curso.';
    await mockApi(page);
    await page.route(`**/api/v1/courses/${COURSE.id}`, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      return route.fulfill({
        status: 409,
        json: { error: { code: scenario.code, message, details: [scenario.detail] } },
      });
    });

    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();
    await page.goto(`/courses/${COURSE.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Editar curso' })).toBeVisible();
    await page.getByRole('button', { name: 'A\u00f1adir unidad' }).click();
    await page.locator('[name="title-2"]').fill('Dispositivos');

    const field = page.locator(`[name="${scenario.input}"]`);
    await field.fill(scenario.value);
    await page.getByRole('button', { name: 'Guardar curso' }).click();

    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(new RegExp(message));
    await expect(page.locator(`#${scenario.input}-error`)).toHaveText(message);
    await field.fill('Valor corregido');
    await expect(page.locator(`#${scenario.input}-error`)).toHaveCount(0);
  });
}
