import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewPageContent } from './ReviewPage';

describe('pestaña de revisión', () => {
  it('mientras carga muestra el aviso de carga', () => {
    const html = renderToStaticMarkup(<ReviewPageContent token="token" unitId="unidad-1" onSessionExpired={() => {}} />);
    expect(html).toContain('Revisión');
    expect(html).toContain('Cargando los recursos de la unidad…');
  });

  it('no muestra textos de proveedores ni del modelo 5E', () => {
    const html = renderToStaticMarkup(<ReviewPageContent token="token" unitId="unidad-1" onSessionExpired={() => {}} />);
    expect(html).not.toMatch(/5E|Gemini|Wikipedia/);
  });
});
