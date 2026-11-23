import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { DocumentItem } from '../src/features/materials/model/types';
import type { Resource } from '../src/features/review/model/resource';
import { COURSE, PASSWORD, TEACHER, UNIT, mockApi, signIn } from './support/mockApi';

const unitPath = `/courses/${COURSE.id}/units/${UNIT.id}`;

const material: DocumentItem = {
  id: 'qa09-document',
  fileName: 'Protocolos TCP y UDP.txt',
  kind: 'txt',
  sizeBytes: 512,
  unitId: UNIT.id,
  outcomeIds: [UNIT.outcomes[0].id],
  documentType: 'Guía',
  status: 'procesado',
  registeredAt: '2026-11-14T12:00:00Z',
  processedAt: '2026-11-14T12:01:00Z',
  fragmentCount: 1,
};

const resource: Resource = {
  id: 'qa09-resource',
  unitId: UNIT.id,
  outcomeId: UNIT.outcomes[0].id,
  stage: 'evaluate',
  type: 'glosario',
  title: 'Glosario de protocolos',
  body: 'TCP establece una conexión. UDP envía datagramas.',
  options: null,
  citations: [],
  status: 'pendiente',
  edited: false,
  discardReason: null,
  createdAt: '2026-11-14T12:02:00Z',
  updatedAt: null,
  decidedAt: null,
  evidence: [],
  version: 1,
  verification: null,
  approvalBlockers: [],
};

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
  await page.route('**/api/v1/documents', (route) => route.fulfill({ json: [material] }));
  await page.route(`**/api/v1/units/${UNIT.id}/resources`, (route) => route.fulfill({ json: [resource] }));
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
  const documentCard = page.getByRole('article').filter({ hasText: material.fileName });
  await expect(documentCard.getByRole('heading', { name: material.fileName })).toBeVisible();
  await expect(documentCard.getByRole('button', { name: 'Ver fragmentos (1)' })).toBeVisible();
  await expect(documentCard.getByRole('button', { name: 'Descargar' })).toBeVisible();
  await scan(page, 'Material con un documento procesado');

  await page.goto(`${unitPath}/generation`);
  const chat = page.getByRole('form', { name: 'Chat de Generación' });
  await chat.getByRole('textbox').fill('Quiero dos glosarios');
  await chat.getByRole('button', { name: 'Interpretar' }).click();
  await page.locator('summary').filter({ hasText: 'Explicar (1)' }).click();
  await expect(page.getByRole('radio', { name: 'Glosario', exact: true })).toBeChecked();
  await scan(page, 'Generación con el chat interpretado');

  await page.getByRole('button', { name: 'Generar recurso' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa el pedido antes de generar' })).toBeVisible();
  await scan(page, 'Generación con la vista previa abierta');

  await page.goto(`${unitPath}/review`);
  const title = page.getByRole('textbox', { name: 'Título', exact: true });
  await expect(title).toHaveValue(resource.title);
  await expect(title).toBeEditable();
  await expect(page.getByRole('button', { name: 'Aprobar', exact: true })).toBeEnabled();
  await title.fill('Glosario de TCP y UDP');
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  await scan(page, 'Revisión con un recurso editable');

  await page.goto(`${unitPath}/export`);
  await expect(page.getByRole('button', { name: 'Descargar .xml' })).toBeVisible();
  await scan(page, 'Exportación');

  await page.goto('/downloads');
  await expect(page.getByRole('heading', { name: 'Mis descargas' })).toBeVisible();
  await scan(page, 'Mis descargas');
});
async function tabTo(page: Page, control: Locator, label: string) {
  await expect(control).toBeVisible();
  for (let step = 0; step < 30; step++) {
    await page.keyboard.press('Tab');
    if (await control.evaluate((element) => element === document.activeElement)) {
      await expect(control, label).toBeFocused();
      await expect(control, label).toBeInViewport();
      const visibleFocus = await control.evaluate((element) => {
        const style = getComputedStyle(element);
        return element.matches(':focus-visible')
          && style.outlineStyle !== 'none'
          && Number.parseFloat(style.outlineWidth) > 0
          && style.outlineColor !== 'rgba(0, 0, 0, 0)';
      });
      expect(visibleFocus, `Foco visible en ${label}`).toBe(true);
      return;
    }
  }
  throw new Error(`No se alcanzó con Tab: ${label}`);
}

test('QA-09: navega con teclado y foco visible hasta descargar Moodle XML', async ({ page }) => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><quiz></quiz>';
  await mockApi(page);
  await page.route(`**/api/v1/units/${UNIT.id}/exports`, (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject({ format: 'moodle_xml' });
    return route.fulfill({
      contentType: 'application/xml',
      headers: { 'content-disposition': 'attachment; filename="qa09-moodle.xml"' },
      body: xml,
    });
  });

  await page.goto('/login');
  await tabTo(page, page.getByLabel('Correo electrónico'), 'Correo electrónico');
  await page.keyboard.type(TEACHER.email);
  await tabTo(page, page.getByLabel('Contraseña'), 'Contraseña');
  await page.keyboard.type(PASSWORD);
  await tabTo(page, page.getByRole('button', { name: 'Iniciar sesión' }), 'Iniciar sesión');
  await page.keyboard.press('Enter');

  await tabTo(page, page.getByRole('link', { name: 'Entrar al curso' }), 'Entrar al curso');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: COURSE.name, level: 1 })).toBeVisible();

  await tabTo(page, page.getByRole('link', { name: 'Abrir unidad' }), 'Abrir unidad');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: UNIT.title, level: 1 })).toBeVisible();

  await tabTo(page, page.getByRole('link', { name: 'Exportación' }), 'Exportación');
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Descargar .xml' }), 'Descargar .xml');

  const downloading = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('qa09-moodle.xml');
  expect(await readFile(await download.path(), 'utf8')).toBe(xml);
});
