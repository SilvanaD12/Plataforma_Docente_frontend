import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Resource } from '../model/resource';
import { ResourceEditor } from './ResourceEditor';

function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'rec-1', unitId: 'unidad-1', outcomeId: null, stage: 'evaluate', type: 'item_opcion_multiple',
    title: 'TCP o UDP', body: '¿Qué protocolo confirma la entrega?', bodyHtml: null, format: 'text', structure: null, media: null,
    options: [
      { id: 'a', text: 'TCP', isCorrect: true, feedback: '', sourceFragmentIds: [], decision: 'pendiente', discardReason: null, edited: false },
      { id: 'b', text: 'UDP', isCorrect: false, feedback: '', sourceFragmentIds: [], decision: 'pendiente', discardReason: null, edited: false,
        reliabilityWarning: 'El material también lo presenta como respuesta.' },
    ],
    citations: [], status: 'pendiente', edited: false, discardReason: null, createdAt: '2026-11-08T15:00:00+00:00',
    updatedAt: null, decidedAt: null, evidence: [], version: 2, verification: null,
    approvalBlockers: ['Decide el distractor pendiente para poder aprobar.'],
    ...overrides,
  };
}

const noop = async () => resource();
const render = (value: Resource) =>
  renderToStaticMarkup(<ResourceEditor resource={value} onSave={noop} onReload={noop} onRetry={noop} />);

describe('editor de un recurso', () => {
  it('muestra el título, el enunciado y las alternativas para editar', () => {
    const html = render(resource());
    expect(html).toContain('value="TCP o UDP"');
    expect(html).toContain('¿Qué protocolo confirma la entrega?');
    expect(html).toContain('value="UDP"');
    expect(html).toContain('Respuesta correcta');
  });

  it('sin una solicitud en curso, los campos se pueden editar', () => {
    const html = render(resource());
    expect(html).not.toMatch(/<(input|textarea|select)[^>]*disabled=""/);
  });

  it('muestra el estado de revisión del recurso', () => {
    expect(render(resource())).toContain('Pendiente de revisión');
    expect(render(resource({ status: 'aprobado', approvalBlockers: [] }))).toContain('Aprobado');
  });

  it('muestra los bloqueos que informa el servidor y no ofrece aprobar sin cambios', () => {
    const html = render(resource());
    expect(html).toContain('Decide el distractor pendiente para poder aprobar.');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Aprobar<\/button>/);
  });

  it('mientras haya distractores por decidir, lo indica junto al botón de aprobar', () => {
    expect(render(resource())).toContain('Decide el distractor pendiente para poder aprobar.');
  });

  it('muestra el aviso de fiabilidad de un distractor (REV-C4)', () => {
    expect(render(resource())).toContain('El material también lo presenta como respuesta.');
  });

  it('incluye la insignia de verificación del recurso', () => {
    const html = render(resource({
      verification: {
        status: 'insufficient', reason: 'Sin respaldo en el material.', fingerprint: 'sha256:' + 'a'.repeat(64),
        verifiedVersion: 2, evidenceThreshold: 0.6, ruleVersion: 1, checkedAt: '2026-11-08T15:00:00+00:00',
        retryAvailable: false, summary: {},
      },
    }));
    expect(html).toContain('Insuficiente');
    expect(html).toContain('Sin respaldo en el material.');
  });

  it('no muestra textos de proveedores ni del modelo 5E', () => {
    expect(render(resource())).not.toMatch(/5E|Gemini|Wikipedia/);
  });
});

describe('descartar un recurso', () => {
  it('un recurso en revisión ofrece descartar eligiendo el motivo', () => {
    const html = render(resource());
    expect(html).toContain('Motivo del descarte');
    expect(html).toContain('No corresponde a la unidad');
    expect(html).not.toContain('Reemplazado por uno regenerado');
    expect(html).toMatch(/<button[^>]*>Descartar<\/button>/);
  });

  it('un recurso descartado muestra su motivo y ofrece volver a revisión', () => {
    const html = render(resource({ status: 'descartado', discardReason: 'regenerado', approvalBlockers: [] }));
    expect(html).toContain('Reemplazado por uno regenerado');
    expect(html).toMatch(/<button[^>]*>Volver a revisión<\/button>/);
    expect(html).not.toMatch(/<button[^>]*>Descartar<\/button>/);
  });
});

describe('estructura del recurso', () => {
  it('una actividad muestra sus elementos para editar; una pregunta no', () => {
    const activity = render(resource({ type: 'ordenar_pasos', format: 'interactive', options: null, approvalBlockers: [],
      structure: { sequence: ['Conectar', 'Enviar', 'Confirmar'] } }));
    expect(activity).toContain('Pasos en orden');
    expect(activity).toContain('value="Confirmar"');
    expect(render(resource())).not.toContain('Pasos en orden');
  });
});

describe('multimedia invalidada', () => {
  it('muestra el aviso y «Generar de nuevo» en un recurso pendiente (REV-C8)', () => {
    const value = resource({
      type: 'imagen_ilustrativa', format: 'image', options: null,
      structure: { prompt: 'Dos routers conectados', alt: 'Dos routers', caption: '' },
      media: { status: 'fallback', invalidated: true },
      approvalBlockers: ['Cambiaste el guion o la descripción: genera el archivo de nuevo para poder aprobar.'],
    });
    const html = renderToStaticMarkup(
      <ResourceEditor resource={value} onSave={noop} onReload={noop} onRetry={noop} onGenerateMedia={noop} />,
    );
    expect(html).toContain('el archivo anterior ya no se usa');
    expect(html).toMatch(/<button[^>]*>Generar de nuevo<\/button>/);
  });
});
