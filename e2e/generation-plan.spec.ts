import { expect, test, type Page, type Route } from '@playwright/test';
import { COURSE, UNIT, mockApi, signIn } from './support/mockApi';

/**
 * GEN-P3 con el API simulado: con GENERATION_REQUIRE_PLAN=true, la única forma de generar es planificar, aprobar el plan
 * y generar desde él. Las formas siguen specs/006-plan-de-generacion/contracts/generation-plans.openapi.yaml del backend.
 */

const unitPath = `/courses/${COURSE.id}/units/${UNIT.id}`;

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gen-plan-e2e',
    version: 1,
    status: 'draft',
    origin: 'teacher',
    unitId: UNIT.id,
    inputs: {
      instructions: '', audience: '', competency: '', outcomeId: null, modality: 'Textual',
      resourceTypes: [{ type: 'glosario', quantity: 2 }],
      difficulty: 'intermedia', optionCount: 4, evidenceThreshold: 0.6, topK: 12,
    },
    evidence: {
      retrievalMode: 'hybrid',
      retrievedAt: '2026-11-25T10:00:00Z',
      fragments: [{
        id: 'frag-1', documentId: 'doc-1', documentName: 'protocolos.txt', location: 'p. 1',
        text: 'TCP usa el puerto de origen y controla el flujo con una ventana.', relevance: 0.9,
      }],
    },
    referents: [],
    sessionContext: { previousTypologies: [] },
    items: [{
      position: 1, stage: 'explain', resourceType: 'glosario', quantity: 2, purpose: 'Fijar los términos de TCP',
      covers: ['puerto de origen', 'control de flujo'], doesNotCover: [], fragmentIds: ['frag-1'],
    }],
    validation: { valid: true, problems: [] },
    warnings: [],
    generator: { description: 'Planificador por reglas', usesAi: false, fallback: false, fallbackReason: null, attempts: 0 },
    usedByRequestId: null,
    createdAt: '2026-11-25T10:00:00Z',
    updatedAt: '2026-11-25T10:00:00Z',
    approvedAt: null,
    usedAt: null,
    ...overrides,
  };
}

function generationRequest(status: 'running' | 'succeeded') {
  return {
    id: 'gen-req-e2e', mode: 'sequence', unitId: UNIT.id, status, resourceTypes: ['glosario'],
    createdAt: '2026-11-25T10:01:00Z', finishedAt: status === 'succeeded' ? '2026-11-25T10:02:00Z' : null,
    parameters: {
      resourceTypes: ['glosario'], quantity: 2, difficulty: 'intermedia', optionCount: 4, topK: 12, evidenceThreshold: 0.6,
      instructions: '', audience: '', competency: '', modalities: ['Textual'],
    },
    planId: 'gen-plan-e2e', planVersion: 1, retrievalMode: 'hybrid', failure: null,
    steps: [{
      position: 0, stage: 'explain', resourceType: 'glosario', agent: 'Agente de Explicar', status,
      resourceIds: status === 'succeeded' ? ['res-1', 'res-2'] : [], rejections: [],
      resources: status === 'succeeded'
        ? [{ id: 'res-1', title: 'Glosario 1', verificationStatus: 'current' }, { id: 'res-2', title: 'Glosario 2', verificationStatus: 'current' }]
        : [],
    }],
  };
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Simula el plan y la generación, y guarda cada cuerpo de POST /generation-requests. */
async function mockPlanFlow(page: Page) {
  const generationBodies: unknown[] = [];
  const planBodies: unknown[] = [];
  await page.route('**/api/v1/generation-requests/interpret', (route) => json(route, 200, {
    draft: { unitId: UNIT.id, mode: 'sequence', resourceTypes: ['glosario'], quantity: 2 },
    stages: [{ resourceType: 'glosario', stage: 'explain' }],
    issues: [],
  }));
  await page.route('**/api/v1/generation-plans', (route) => {
    const request = route.request();
    if (request.method() === 'GET') return json(route, 200, []);
    planBodies.push(request.postDataJSON());
    return json(route, 201, plan());
  });
  await page.route('**/api/v1/generation-plans/gen-plan-e2e/approve', (route) => {
    expect(route.request().postDataJSON()).toEqual({ expectedVersion: 1 });
    return json(route, 200, plan({ status: 'approved', approvedAt: '2026-11-25T10:00:30Z' }));
  });
  await page.route('**/api/v1/generation-requests', (route) => {
    const request = route.request();
    if (request.method() === 'GET') return json(route, 200, []);
    generationBodies.push(request.postDataJSON());
    return json(route, 202, generationRequest('running'));
  });
  await page.route('**/api/v1/generation-requests/gen-req-e2e', (route) => json(route, 200, generationRequest('succeeded')));
  return { generationBodies, planBodies };
}

test('del chat al plan aprobado: se genera solo desde el plan, nunca con el cuerpo sin plan', async ({ page }) => {
  await mockApi(page);
  const { generationBodies, planBodies } = await mockPlanFlow(page);

  await signIn(page);
  await expect(page.getByRole('link', { name: 'Entrar al curso' })).toBeVisible();
  await page.goto(`${unitPath}/generation`);

  // El chat (HU-038) llena el formulario; desde ahí se planifica.
  const chat = page.getByRole('form', { name: 'Chat de Generación' });
  await chat.getByRole('textbox').fill('Quiero dos glosarios');
  await chat.getByRole('button', { name: 'Interpretar' }).click();
  await page.locator('summary').filter({ hasText: 'Explicar (1)' }).click();
  await expect(page.getByRole('checkbox', { name: 'Glosario', exact: true })).toBeChecked();

  // El formulario ya no tiene «Generar»: su acción principal es «Planificar».
  const form = page.getByRole('form', { name: 'Nueva generación' });
  await expect(form.getByRole('button', { name: /Generar/ })).toHaveCount(0);
  await form.getByRole('button', { name: 'Planificar', exact: true }).click();

  // Vista previa (HU-040): tipos y orden antes de confirmar el plan.
  await expect(page.getByRole('heading', { name: 'Revisa lo que vas a planificar' })).toBeFocused();
  await expect(page.getByText('Total: 2 recursos', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar y planificar' }).click();

  // Pantalla del plan: «Generar» solo con el plan aprobado.
  await expect(page.getByRole('heading', { name: 'Plan de generación' })).toBeVisible();
  expect(planBodies).toEqual([expect.objectContaining({ unitId: UNIT.id, resourceTypes: [{ type: 'glosario', quantity: 2 }] })]);
  const generate = page.getByRole('button', { name: 'Generar', exact: true });
  await expect(generate).toBeDisabled();
  await page.getByRole('button', { name: 'Aprobar plan' }).click();
  await expect(page.getByText('Aprobado · versión 1')).toBeVisible();
  await expect(generate).toBeEnabled();

  await generate.click();
  await expect(page.getByText('Terminado', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Glosario 1' })).toBeVisible();

  // Ningún pedido de generación salió sin plan.
  expect(generationBodies).toEqual([{ planId: 'gen-plan-e2e', planVersion: 1 }]);
});
