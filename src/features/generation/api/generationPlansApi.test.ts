import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateGenerationPlan, UpdateGenerationPlan } from '../model/generationPlan';
import { startGenerationRequest } from './generationApi';
import {
  approveGenerationPlan, createGenerationPlan, getGenerationPlan, listGenerationPlans, updateGenerationPlan,
} from './generationPlansApi';

const body: CreateGenerationPlan = {
  unitId: 'unidad-1',
  instructions: 'Diferencias entre TCP y UDP',
  audience: 'Tercer ciclo',
  competency: '',
  outcomeId: null,
  modality: 'Textual',
  resourceTypes: [{ type: 'pregunta_detonante', quantity: 1 }, { type: 'explicacion', quantity: null }],
};
const plan = { id: 'gen-plan-1', version: 1, status: 'draft' };

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const headers = (fetchMock: ReturnType<typeof stubFetch>, call = 0) => new Headers(fetchMock.mock.calls[call][1]?.headers);

afterEach(() => vi.unstubAllGlobals());

describe('API de planes de generación', () => {
  it('POST /generation-plans envía la clave y el cuerpo, y marca el plan como nuevo con 201', async () => {
    const fetchMock = stubFetch(Response.json(plan, { status: 201 }));

    await expect(createGenerationPlan('token-docente', 'clave-12345678', body)).resolves.toEqual({ plan, created: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-plans', expect.objectContaining({
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(headers(fetchMock).get('Idempotency-Key')).toBe('clave-12345678');
    expect(headers(fetchMock).get('Authorization')).toBe('Bearer token-docente');
  });

  it('con la misma clave y el mismo cuerpo devuelve el plan existente (200)', async () => {
    stubFetch(Response.json(plan));
    await expect(createGenerationPlan('token-docente', 'clave-12345678', body)).resolves.toEqual({ plan, created: false });
  });

  it('INSUFFICIENT_EVIDENCE conserva el código y el mensaje del servidor', async () => {
    stubFetch(Response.json({ error: { code: 'INSUFFICIENT_EVIDENCE', message: 'El material no trata «llaves primarias».' } }, { status: 422 }));
    await expect(createGenerationPlan('t', 'clave-12345678', body)).rejects.toMatchObject({
      status: 422, code: 'INSUFFICIENT_EVIDENCE', message: 'El material no trata «llaves primarias».',
    });
  });

  it('GET /generation-plans lista los planes de la unidad, con filtros opcionales', async () => {
    const fetchMock = stubFetch(Response.json([plan]), Response.json([]));

    await expect(listGenerationPlans('token-docente', 'unidad 1')).resolves.toEqual([plan]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/generation-plans?unitId=unidad+1');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' });

    await listGenerationPlans('token-docente', 'unidad-1', { status: 'draft', limit: 1 });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/generation-plans?unitId=unidad-1&status=draft&limit=1');
  });

  it('GET /generation-plans/{id} consulta un plan con el id codificado', async () => {
    const fetchMock = stubFetch(Response.json(plan));
    await expect(getGenerationPlan('token-docente', 'gen/plan')).resolves.toEqual(plan);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-plans/gen%2Fplan', expect.objectContaining({ method: 'GET' }));
  });

  it('PUT /generation-plans/{id} envía expectedVersion y los ítems', async () => {
    const update: UpdateGenerationPlan = {
      expectedVersion: 3,
      items: [{ resourceType: 'glosario', quantity: 1, purpose: 'Fijar términos', covers: ['puerto de origen'], fragmentIds: ['frag-1'] }],
    };
    const fetchMock = stubFetch(Response.json({ ...plan, version: 4 }));

    await expect(updateGenerationPlan('token-docente', 'gen-plan-1', update)).resolves.toMatchObject({ version: 4 });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-plans/gen-plan-1', expect.objectContaining({
      method: 'PUT', body: JSON.stringify(update),
    }));
  });

  it('PUT con otra versión conserva PLAN_VERSION_CONFLICT', async () => {
    stubFetch(Response.json({ error: { code: 'PLAN_VERSION_CONFLICT', message: 'El plan cambió.' } }, { status: 409 }));
    await expect(updateGenerationPlan('t', 'gen-plan-1', { expectedVersion: 1, items: [] }))
      .rejects.toMatchObject({ status: 409, code: 'PLAN_VERSION_CONFLICT' });
  });

  it('POST /generation-plans/{id}/approve envía la versión revisada', async () => {
    const fetchMock = stubFetch(Response.json({ ...plan, status: 'approved' }));

    await expect(approveGenerationPlan('token-docente', 'gen-plan-1', 2)).resolves.toMatchObject({ status: 'approved' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-plans/gen-plan-1/approve', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ expectedVersion: 2 }),
    }));
  });

  it('approve con PLAN_INVALID trae los problemas en details', async () => {
    const problems = [{ code: 'ITEM_WITHOUT_EVIDENCE', message: 'El ítem 2 no cita fragmentos.', itemPosition: 2 }];
    stubFetch(Response.json({ error: { code: 'PLAN_INVALID', message: 'El plan tiene problemas.', details: problems } }, { status: 422 }));
    await expect(approveGenerationPlan('t', 'gen-plan-1', 2)).rejects.toMatchObject({ status: 422, code: 'PLAN_INVALID', details: problems });
  });

  it('POST /generation-requests con {planId, planVersion} y la clave de idempotencia', async () => {
    const fetchMock = stubFetch(Response.json({ id: 'gen-req-1', planId: 'gen-plan-1', planVersion: 2 }, { status: 202 }));

    await expect(startGenerationRequest('token-docente', 'clave-12345678', { planId: 'gen-plan-1', planVersion: 2 }))
      .resolves.toMatchObject({ created: true, request: { planId: 'gen-plan-1' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-requests', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ planId: 'gen-plan-1', planVersion: 2 }),
    }));
    expect(headers(fetchMock).get('Idempotency-Key')).toBe('clave-12345678');
  });

  it('PLAN_EVIDENCE_STALE al generar trae los documentos afectados', async () => {
    const details = [{ documentId: 'doc-1', documentName: 'protocolos.pdf', missingFragmentIds: ['frag-1', 'frag-2'] }];
    stubFetch(Response.json({ error: { code: 'PLAN_EVIDENCE_STALE', message: 'El material del plan cambió.', details } }, { status: 409 }));
    await expect(startGenerationRequest('t', 'clave-12345678', { planId: 'gen-plan-1', planVersion: 2 }))
      .rejects.toMatchObject({ status: 409, code: 'PLAN_EVIDENCE_STALE', details });
  });
});
