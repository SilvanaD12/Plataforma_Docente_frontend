import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { COURSE, UNIT, mockApi, signIn } from './support/mockApi';

const unitPath = `/courses/${COURSE.id}/units/${UNIT.id}`;

async function scan(page: Page, screen: string) {
  await test.step(`Axe: ${screen}`, async () => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id, impact, nodes }) => ({
        id,
        impact,
        elements: nodes.map(({ target }) => target.join(' ')),
      }));

    expect.soft(blocking, `Violaciones serias o críticas en ${screen}`).toEqual([]);
  });
}

test('QA-09: evalúa la accesibilidad de las pantallas del sprint', async ({ page }) => {
  test.setTimeout(90_000);
  await mockApi(page);
  await page.route('**/api/v1/generation-requests/interpret', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        draft: {
          unitId: UNIT.id,
          mode: 'individual',
          resourceTypes: ['glosario'],
          quantity: 2,
        },
        stages: [{ resourceType: 'glosario', stage: 'explain' }],
        issues: [],
      },
    });
  });

  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await scan(page, 'Inicio de sesión');

  await signIn(page);
  await expect(page.getByRole('link', { name: 'Entrar al curso' })).toBeVisible();
  await scan(page, 'Mis cursos');

  await page.goto(`${unitPath}/material`);
  await expect(page.getByText('Esta unidad todavía no tiene materiales registrados.')).toBeVisible();
  await scan(page, 'Material');

  await page.goto(`${unitPath}/generation`);
  const chat = page.getByRole('form', { name: 'Chat de Generación' });
  await chat.getByRole('textbox').fill('Quiero dos glosarios');
  await chat.getByRole('button', { name: 'Interpretar' }).click();
  await expect(page.getByRole('radio', { name: 'Glosario', exact: true })).toBeChecked();
  await scan(page, 'Generación con el chat interpretado');

  await page.getByRole('button', { name: 'Generar recurso' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa el pedido antes de generar' })).toBeVisible();
  await scan(page, 'Generación con la vista previa abierta');

  await page.goto(`${unitPath}/review`);
  await expect(page.getByText('Esta unidad todavía no tiene recursos para revisar.', { exact: false })).toBeVisible();
  await scan(page, 'Revisión');

  await page.goto(`${unitPath}/export`);
  await expect(page.getByRole('button', { name: 'Descargar .xml' })).toBeVisible();
  await scan(page, 'Exportación');

  await page.goto('/downloads');
  await expect(page.getByRole('heading', { name: 'Mis descargas' })).toBeVisible();
  await scan(page, 'Mis descargas');
});