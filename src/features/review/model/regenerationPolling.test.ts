import { describe, expect, it, vi } from 'vitest';
import type { RegenerationStatusResult } from '../api/reviewApi';
import {
  POLL_INTERVAL_MS,
  regenerationFailureNotice,
  regenerationProgressNotice,
  waitForRegeneration,
} from './regenerationView';

const status = (value: RegenerationStatusResult['status'], extra: Partial<RegenerationStatusResult> = {}): RegenerationStatusResult => ({
  previousResourceId: 'rec-1', previousDiscarded: false, newResourceIds: [], status: value, reason: null, code: null, ...extra,
});

describe('esperar una regeneración en segundo plano (D10)', () => {
  it('consulta el estado mientras sigue en curso y devuelve el resultado al terminar', async () => {
    const check = vi.fn<() => Promise<RegenerationStatusResult>>()
      .mockResolvedValueOnce(status('running'))
      .mockResolvedValueOnce(status('running'))
      .mockResolvedValueOnce(status('succeeded', { previousDiscarded: true, newResourceIds: ['rec-2'] }));
    const wait = vi.fn(async () => {});

    await expect(waitForRegeneration(check, wait)).resolves.toMatchObject({ status: 'succeeded', newResourceIds: ['rec-2'] });
    expect(check).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledWith(POLL_INTERVAL_MS);
  });

  it('un fallo termina la espera con su motivo', async () => {
    const check = vi.fn(async () => status('failed', { reason: 'Procesa primero un documento de la unidad.', code: 'NO_PROCESSED_MATERIAL' }));
    await expect(waitForRegeneration(check, async () => {})).resolves.toMatchObject({ status: 'failed', code: 'NO_PROCESSED_MATERIAL' });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('si no termina dentro del máximo de intentos, deja de consultar', async () => {
    const check = vi.fn(async () => status('running'));
    await expect(waitForRegeneration(check, async () => {}, 4)).resolves.toBeNull();
    expect(check).toHaveBeenCalledTimes(4);
  });

  it('se puede detener, por ejemplo al salir de la revisión', async () => {
    const check = vi.fn(async () => status('running'));
    await expect(waitForRegeneration(check, async () => {}, 40, () => true)).resolves.toBeNull();
    expect(check).not.toHaveBeenCalled();
  });
});

describe('avisos de la regeneración en segundo plano', () => {
  it('mientras sigue en curso', () => {
    expect(regenerationProgressNotice()).toBe(
      'Se está preparando el recurso nuevo. La revisión se actualizará sola cuando termine.',
    );
  });

  it('si falla, con el motivo de Generación (REV-C13)', () => {
    expect(regenerationFailureNotice(status('failed', { reason: 'Procesa primero un documento de la unidad.' })))
      .toBe('No se pudo regenerar el recurso: Procesa primero un documento de la unidad. El recurso quedó como estaba.');
    expect(regenerationFailureNotice(status('failed')))
      .toBe('No se pudo regenerar el recurso. El recurso quedó como estaba.');
  });
});
