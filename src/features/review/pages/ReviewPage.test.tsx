import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewPageContent, ReviewSessionMissing } from './ReviewPage';

describe('pestaña de revisión', () => {
  it('mientras carga muestra el aviso de carga', () => {
    const html = renderToStaticMarkup(<ReviewPageContent token="token" unitId="unidad-1" onSessionExpired={() => {}} />);
    expect(html).toContain('Revisión');
    expect(html).toContain('Cargando los recursos de la unidad…');
  });

  it('sin sesión en el contexto de la unidad muestra un aviso en lugar de llamar a la API', () => {
    const html = renderToStaticMarkup(<ReviewSessionMissing />);
    expect(html).toContain('role="alert"');
    expect(html).not.toMatch(/5E|Gemini|Wikipedia/);
  });
});
