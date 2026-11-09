import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DownloadsPage } from './DownloadsPage';

const render = () => renderToStaticMarkup(<DownloadsPage token="token" onSessionExpired={() => {}} />);

describe('página «Mis descargas»', () => {
  it('carga el historial del docente sin depender de un curso ni de una unidad (REV-C9)', () => {
    const html = render();
    expect(html).toContain('Mis descargas');
    expect(html).toContain('Cargando tu historial de descargas…');
  });

  it('explica que las descargas se conservan aunque se borre el curso', () => {
    expect(render()).toContain('se conservan aunque borres el curso');
  });

  it('no muestra textos de proveedores ni del modelo 5E', () => {
    expect(render()).not.toMatch(/5E|Gemini|Wikipedia/);
  });
});
