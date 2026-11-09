import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TeacherWorkspace } from './TeacherWorkspace';

const session = { token: 'token', name: 'Ana', email: 'ana@correo.pe' };

describe('menú del docente', () => {
  it('ofrece «Mis descargas» junto a «Mis cursos», aunque no haya cursos (revisión de Silvana, PR #7)', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/courses']}>
        <TeacherWorkspace session={session} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(html).toMatch(/<a[^>]*href="\/courses"[^>]*>Mis cursos<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/downloads"[^>]*>Mis descargas<\/a>/);
  });
});
