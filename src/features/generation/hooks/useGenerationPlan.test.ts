import { afterEach, describe, expect, it, vi } from 'vitest';
import { listGenerationPlans } from '../api/generationPlansApi';
import type { CreateGenerationPlan } from '../model/generationPlan';
import { generationPlan } from '../testing/planFixtures';
import { planAttemptKey, recoverLatestPlan } from './useGenerationPlan';

afterEach(() => vi.unstubAllGlobals());

describe('Recuperar el plan al recargar (PLAN-C14)', () => {
  it('pide la lista de planes de la unidad y restaura el último borrador con sus cambios guardados', async () => {
    const saved = generationPlan({ version: 4, items: generationPlan().items.map((item) => ({ ...item, purpose: 'Editado y guardado' })) });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([saved, generationPlan({ id: 'viejo', updatedAt: '2026-11-01T00:00:00Z' })]));
    vi.stubGlobal('fetch', fetchMock);

    const restored = await recoverLatestPlan(() => listGenerationPlans('token-docente', 'unidad-1'));

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/generation-plans?unitId=unidad-1');
    expect(restored).toMatchObject({ id: 'gen-plan-1', version: 4, status: 'draft' });
    expect(restored?.items.every(({ purpose }) => purpose === 'Editado y guardado')).toBe(true);
  });

  it('no restaura un plan ya usado ni nada si la unidad no tiene planes', async () => {
    await expect(recoverLatestPlan(async () => [generationPlan({ status: 'used' })])).resolves.toBeNull();
    await expect(recoverLatestPlan(async () => [])).resolves.toBeNull();
  });
});

describe('Clave de idempotencia del plan', () => {
  const body: CreateGenerationPlan = { unitId: 'unidad-1', resourceTypes: [{ type: 'glosario', quantity: null }] };
  let next = 0;
  const newKey = () => 'clave-nueva-' + ++next;

  it('reutiliza la clave solo para reenviar el mismo cuerpo tras un fallo de red', () => {
    expect(planAttemptKey({ key: 'clave-previa', body, unanswered: true }, body, newKey)).toBe('clave-previa');
    expect(planAttemptKey({ key: 'clave-previa', body, unanswered: false }, body, newKey)).toMatch(/^clave-nueva-/);
    expect(planAttemptKey({ key: 'clave-previa', body, unanswered: true }, { ...body, instructions: 'otro tema' }, newKey)).toMatch(/^clave-nueva-/);
    expect(planAttemptKey(null, body, newKey)).toMatch(/^clave-nueva-/);
  });
});
