import { afterEach, describe, expect, it, vi } from 'vitest';
import { generationStorage } from './generationStorage';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

const entry = {
  key: 'clave-12345678',
  payload: { mode: 'individual' as const, unitId: 'unidad-1', resourceTypes: ['glosario'] },
  requestId: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('Pedido guardado por unidad', () => {
  it('guarda, lee y limpia el pedido bajo generation:{unitId}', () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });

    generationStorage.save('unidad-1', entry);
    expect([...sessionStorage.values.keys()]).toEqual(['generation:unidad-1']);
    expect(generationStorage.read('unidad-1')).toEqual(entry);
    expect(generationStorage.read('unidad-2')).toBeNull();

    generationStorage.clear('unidad-1');
    expect(generationStorage.read('unidad-1')).toBeNull();
  });

  it('ignora valores dañados o con otra forma', () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });

    sessionStorage.setItem('generation:unidad-1', '{no es json');
    expect(generationStorage.read('unidad-1')).toBeNull();
    sessionStorage.setItem('generation:unidad-1', JSON.stringify({ key: 1, payload: {}, requestId: null }));
    expect(generationStorage.read('unidad-1')).toBeNull();
  });

  it('no falla si el navegador bloquea el almacenamiento', () => {
    const blocked = () => { throw new DOMException('Bloqueado', 'SecurityError'); };
    vi.stubGlobal('window', { sessionStorage: { getItem: blocked, setItem: blocked, removeItem: blocked } });

    expect(() => generationStorage.save('unidad-1', entry)).not.toThrow();
    expect(generationStorage.read('unidad-1')).toBeNull();
    expect(() => generationStorage.clear('unidad-1')).not.toThrow();
  });
});
