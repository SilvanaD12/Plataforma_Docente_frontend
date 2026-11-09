import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { structureSchema } from '../model/structureEditor';
import { StructureEditor } from './StructureEditor';

const noop = () => {};

function render(type: string, structure: Record<string, unknown>, disabled = false) {
  const schema = structureSchema(type);
  if (!schema) throw new Error('sin estructura');
  return renderToStaticMarkup(
    <StructureEditor
      idPrefix="rec-1"
      schema={schema}
      structure={structure}
      disabled={disabled}
      onField={noop}
      onItem={noop}
      onAdd={noop}
      onRemove={noop}
    />,
  );
}

describe('editor de la estructura', () => {
  it('muestra los campos y cada elemento de la lista para editar', () => {
    const html = render('mapa_conceptual', { central: 'Transporte', nodes: [{ label: 'TCP', detail: 'Confiable' }] });
    expect(html).toContain('Idea central');
    expect(html).toContain('value="Transporte"');
    expect(html).toContain('value="TCP"');
    expect(html).toMatch(/<button[^>]*>Agregar concepto<\/button>/);
    expect(html).toMatch(/<button[^>]*>Quitar concepto 1<\/button>/);
  });

  it('en verdadero o falso se elige si cada enunciado es verdadero', () => {
    const html = render('verdadero_falso', { statements: [{ text: 'TCP confirma', isTrue: true, feedback: '' }] });
    expect(html).toContain('Verdadero');
    expect(html).toContain('Falso');
  });

  it('con una solicitud en curso los campos quedan desactivados', () => {
    const html = render('ordenar_pasos', { sequence: ['A', 'B', 'C'] }, true);
    expect(html).not.toMatch(/<(input|textarea|button)(?![^>]*disabled="")[^>]*>/);
  });
});
