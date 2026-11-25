import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Resource } from '../src/features/review/model/resource';
import { COURSE, UNIT, mockApi, signIn } from './support/mockApi';

const unitPath = `/courses/${COURSE.id}/units/${UNIT.id}`;

function makeResource(id: string, overrides: Partial<Resource> = {}): Resource {
  return {
    id,
    unitId: UNIT.id,
    outcomeId: UNIT.outcomes[0].id,
    stage: 'explain',
    type: 'explicacion',
    title: `Recurso ${id}`,
    body: 'TCP es un protocolo orientado a conexión que garantiza la entrega.',
    bodyHtml: null,
    format: 'text',
    structure: null,
    media: null,
    options: null,
    citations: [{ claim: 'TCP garantiza entrega', fragmentIds: ['f-wiki', 'f-pdf'] }],
    status: 'pendiente',
    edited: false,
    discardReason: null,
    createdAt: '2026-11-25T10:00:00Z',
    updatedAt: null,
    decidedAt: null,
    evidence: [
      {
        id: 'f-wiki',
        text: 'El protocolo TCP establece una conexión fiable antes de intercambiar datos entre procesos.',
        location: 'Introducción',
        documentId: 'doc-wiki',
        documentName: 'Wikipedia - Transmission Control Protocol',
        sourceUrl: 'https://es.wikipedia.org/wiki/TCP',
      },
      {
        id: 'f-pdf',
        text: 'Fragmento del libro docente con control de flujo y congestión mediante ventana deslizante.',
        location: 'p. 18',
        documentId: 'doc-pdf',
        documentName: 'Redes de Computadoras.pdf',
        sourceUrl: null,
      },
    ],
    version: 1,
    verification: {
      status: 'current',
      reason: null,
      fingerprint: 'sha256:' + 'a'.repeat(64),
      verifiedVersion: 1,
      evidenceThreshold: 0.6,
      ruleVersion: 1,
      checkedAt: '2026-11-25T10:01:00Z',
      retryAvailable: false,
      summary: {},
    },
    approvalBlockers: [],
    ...overrides,
  };
}

test('REV-P5: agrupa por estado, gestiona tarjetas plegables, citas, cambios sin guardar, foco y accesibilidad', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await mockApi(page);

  let stored: Resource[] = [
    makeResource('p-evaluate', {
      title: 'Evaluación de puertos',
      stage: 'evaluate',
      type: 'explicacion',
      createdAt: '2026-11-25T09:00:00Z',
    }),
    makeResource('p-engage', {
      title: 'Pregunta inicial TCP',
      stage: 'engage',
      type: 'pregunta_detonante',
      createdAt: '2026-11-25T11:00:00Z',
    }),
    makeResource('a-explain', {
      title: 'Resumen aprobado TCP',
      stage: 'explain',
      status: 'aprobado',
      decidedAt: '2026-11-25T12:00:00Z',
    }),
    makeResource('d-explore', {
      title: 'Guía descartada',
      stage: 'explore',
      type: 'guia_exploracion',
      status: 'descartado',
      discardReason: 'duplicado',
    }),
  ];

  await page.route(`**/api/v1/units/${UNIT.id}/resources`, async (route) => {
    await route.fulfill({ json: stored });
  });

  await page.route(`**/api/v1/units/${UNIT.id}/resources/*`, async (route) => {
    const req = route.request();
    if (req.method() !== 'PUT') return route.fallback();
    const id = req.url().split('/').pop()!;
    const payload = req.postDataJSON() as { title: string; body: string; status: Resource['status']; discardReason: Resource['discardReason'] };
    const existing = stored.find((item) => item.id === id)!;
    const updated: Resource = {
      ...existing,
      title: payload.title,
      body: payload.body,
      status: payload.status,
      discardReason: payload.status === 'descartado' ? payload.discardReason : null,
      version: existing.version + 1,
      decidedAt: payload.status !== 'pendiente' ? '2026-11-25T14:15:00Z' : null,
    };
    stored = stored.map((item) => (item.id === id ? updated : item));
    await route.fulfill({ json: updated });
  });

  await page.route(`**/api/v1/units/${UNIT.id}/duplication-report*`, async (route) => {
    await route.fulfill({
      json: {
        threshold: 0.7,
        comparedPairs: 2,
        duplicatePairRate: 0.5,
        flaggedPairs: [
          {
            resourceIdA: 'p-engage',
            resourceIdB: 'a-explain',
            scope: 'resource',
            score: 0.89,
            excerptA: 'Pregunta inicial TCP',
            excerptB: 'Resumen aprobado TCP',
            crossUnit: false,
            unitIdB: null,
            unitTitleB: null,
          },
        ],
      },
    });
  });

  await signIn(page);
  await page.goto(`${unitPath}/review`);

  // Barra de resumen y secciones por estado
  await expect(page.getByLabel('Resumen de recursos por estado')).toContainText(
    'Pendientes (2) · Aprobados (1) · Descartados (1)',
  );

  const pendingToggle = page.getByRole('button', { name: /Pendientes de revisión/ });
  const approvedToggle = page.getByRole('button', { name: /Aprobados/ });
  const discardedToggle = page.getByRole('button', { name: /Descartados/ });

  await expect(pendingToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(approvedToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(discardedToggle).toHaveAttribute('aria-expanded', 'false');

  // Orden dentro de Pendientes: Enganchar antes que Evaluar
  const engageCard = page.locator('#p-engage');
  const evaluateCard = page.locator('#p-evaluate');
  const engageBox = await engageCard.boundingBox();
  const evaluateBox = await evaluateCard.boundingBox();
  expect(engageBox!.y).toBeLessThan(evaluateBox!.y);

  // Tarjeta pendiente abierta con Fuentes citadas cerradas por defecto; al abrir oculta Wikipedia
  const citationsToggle = engageCard.getByRole('button', { name: /Fuentes citadas \(2\)/ });
  await expect(citationsToggle).toHaveAttribute('aria-expanded', 'false');
  await citationsToggle.click();
  await expect(citationsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(engageCard.getByText('F1')).toBeVisible();
  await expect(engageCard.getByText('es.wikipedia.org')).toBeVisible();
  await expect(engageCard.getByText('Transmission Control Protocol')).toHaveCount(0);
  await expect(engageCard.getByRole('link', { name: 'Ver fuente' })).toBeVisible();

  // Cambios sin guardar: impide plegar la tarjeta y muestra aviso en cabecera
  await engageCard.getByRole('textbox', { name: 'Título', exact: true }).fill('Pregunta inicial editada');
  const engageHeaderBtn = engageCard.locator('.resource-card__toggle');
  await expect(engageHeaderBtn).toContainText('Cambios sin guardar');
  await engageHeaderBtn.click();
  await expect(engageHeaderBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(engageCard.getByRole('alert')).toContainText('Guárdalos antes de cerrar la tarjeta');

  // Cerrar todo en Pendientes deja abierta la tarjeta sucia y cierra la limpia
  const pendingSection = page.locator('section.review-section', { has: pendingToggle });
  await pendingSection.getByRole('button', { name: 'Cerrar todo' }).click();
  await expect(engageHeaderBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(evaluateCard.locator('.resource-card__toggle')).toHaveAttribute('aria-expanded', 'false');

  // Guardar la edición de p-engage y abrir p-evaluate de nuevo
  await engageCard.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(engageHeaderBtn).not.toContainText('Cambios sin guardar');
  await evaluateCard.locator('.resource-card__toggle').click();

  // El enlace del aviso de duplicidad abre la sección Aprobados y la tarjeta a-explain
  await page.getByRole('link', { name: /Ir a «Resumen aprobado TCP»/ }).click();
  await expect(approvedToggle).toHaveAttribute('aria-expanded', 'true');
  const approvedCard = page.locator('#a-explain');
  await expect(approvedCard.locator('.resource-card__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(approvedCard.getByText(/Aprobado el /)).toBeVisible();
  await expect(approvedCard.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);

  // Al editar un recurso ya aprobado reaparece el botón Aprobar
  await approvedCard.getByRole('textbox', { name: 'Título', exact: true }).fill('Resumen editado');
  await expect(approvedCard.getByRole('button', { name: 'Aprobar', exact: true })).toBeVisible();
  await approvedCard.getByRole('textbox', { name: 'Título', exact: true }).fill('Resumen aprobado TCP');

  // Al aprobar p-engage, se cierra, pasa a Aprobados y el foco pasa al siguiente pendiente (p-evaluate)
  await engageCard.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await expect(page.getByLabel('Resumen de recursos por estado')).toContainText(
    'Pendientes (1) · Aprobados (2) · Descartados (1)',
  );
  await expect(evaluateCard.locator('.resource-card__toggle')).toBeFocused();

  // Al aprobar el último pendiente, el foco pasa al aviso «Todo revisado» con enlace a Exportación
  await evaluateCard.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await expect(page.getByLabel('Resumen de recursos por estado')).toContainText(
    'Pendientes (0) · Aprobados (3) · Descartados (1)',
  );
  const allDone = page.locator('.review-all-done');
  await expect(allDone).toBeVisible();
  await expect(allDone).toBeFocused();
  await expect(allDone.getByRole('link', { name: 'Exportación' })).toBeVisible();

  // Abrir sección Descartados y restaurar recurso: pasa a Pendientes y queda abierto
  await discardedToggle.click();
  const discardedCard = page.locator('#d-explore');
  await expect(discardedCard.locator('.resource-card__toggle')).toContainText('Repite otro recurso');
  await discardedCard.locator('.resource-card__toggle').click();
  await discardedCard.getByRole('button', { name: 'Volver a revisión' }).click();
  await expect(page.getByLabel('Resumen de recursos por estado')).toContainText(
    'Pendientes (1) · Aprobados (3) · Descartados (0)',
  );
  await expect(page.locator('#d-explore .resource-card__toggle')).toHaveAttribute('aria-expanded', 'true');

  // Comprobación axe-core en escritorio y en 375 px de ancho
  const desktopAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    desktopAxe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([]);

  await page.setViewportSize({ width: 375, height: 800 });
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(mobileOverflow).toBe(false);
  const mobileAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    mobileAxe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([]);
});
