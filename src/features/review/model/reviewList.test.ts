import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import type { Resource } from './resource';
import { findResource, listFailed, listLoaded, listMessage, replaceResource } from './reviewList';

const resource = (id: string, overrides: Partial<Resource> = {}) => ({
  id, unitId: 'unidad-1', outcomeId: null, stage: 'explain', type: 'explicacion', title: id, body: 'Contenido.',
  options: null, citations: [], status: 'pendiente', edited: false, discardReason: null, createdAt: '2026-11-08T15:00:00+00:00',
  updatedAt: null, decidedAt: null, evidence: [], version: 1, verification: null, approvalBlockers: [], ...overrides,
} satisfies Resource);

describe('lista de recursos en revisión', () => {
  it('muestra carga, vacío y error con mensajes para el docente', () => {
    expect(listMessage({ status: 'loading' })).toBe('Cargando los recursos de la unidad…');
    expect(listMessage(listLoaded([]))).toBe('Esta unidad todavía no tiene recursos para revisar. Genéralos en la pestaña Generación.');
    expect(listMessage(listFailed(new ApiError(500, 'La base de datos no responde.')))).toBe('La base de datos no responde.');
    expect(listMessage(listLoaded([resource('r1')]))).toBeNull();
  });

  it('una sesión vencida se distingue para devolver al docente al acceso', () => {
    expect(listFailed(new ApiError(401, 'La sesión venció.'))).toEqual({ status: 'expired' });
  });

  it('un error de red muestra el mensaje general', () => {
    expect(listMessage(listFailed(new Error('red')))).toBe('No se pudo conectar con el servidor. Inténtalo de nuevo.');
  });

  it('reemplaza un recurso guardado sin cambiar el orden de la lista', () => {
    const state = replaceResource(listLoaded([resource('r1'), resource('r2')]), resource('r2', { version: 2 }));
    expect(state.status === 'ready' && state.resources.map((r) => [r.id, r.version])).toEqual([['r1', 1], ['r2', 2]]);
  });

  it('encuentra la versión vigente de un recurso al recargarlo después de un conflicto', () => {
    expect(findResource([resource('r1'), resource('r2', { version: 7 })], 'r2').version).toBe(7);
    expect(() => findResource([resource('r1')], 'r9')).toThrow('El recurso ya no existe: vuelve a cargar la revisión.');
  });
});
