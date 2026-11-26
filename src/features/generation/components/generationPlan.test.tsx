import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import type { Unit } from '../../../shared/types/courses';
import { recoverLatestPlan } from '../hooks/useGenerationPlan';
import type { GenerationError } from '../model/generationErrors';
import type { GenerationPlan } from '../model/generationPlan';
import { previewFromRequest } from '../model/generationPreview';
import { StartErrorNotice } from '../pages/GenerationPage';
import { generationPlan, planTypes } from '../testing/planFixtures';
import { FallbackNotices } from './FallbackNotices';
import { GenerationForm } from './GenerationForm';
import { initialGenerationForm } from '../model/generationForm';
import { GenerationPlanView } from './GenerationPlanView';
import { GenerationPreview } from './GenerationPreview';
import { GenerationProgress } from './GenerationProgress';

const unit: Unit = {
  id: 'unidad-1', courseId: 'curso-1', number: 2, title: 'Capa de transporte',
  outcomes: [{ id: 'ra-1', code: 'RA1.1', text: 'Compara TCP y UDP.' }],
};

const render = (element: JSX.Element) => renderToStaticMarkup(<StaticRouter location="/">{element}</StaticRouter>);
const noop = () => undefined;

function view(plan: GenerationPlan, props: Partial<Parameters<typeof GenerationPlanView>[0]> = {}) {
  return render(
    <GenerationPlanView plan={plan} unit={unit} resourceTypes={planTypes} onSave={noop} onApprove={noop} onGenerate={noop}
      onReload={noop} onReplan={noop} onClose={noop} {...props} />,
  );
}

/** El HTML del botón con ese texto exacto. */
function button(html: string, label: string) {
  const match = html.match(new RegExp(`<button[^>]*>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</button>`));
  if (!match) throw new Error(`No hay un botón «${label}»`);
  return match[0];
}

const isDisabled = (html: string, label: string) => button(html, label).includes('disabled=""');

/** El HTML del ítem guardado en esa posición. */
function itemArticle(html: string, position: number) {
  const match = html.match(new RegExp(`<article[^>]*aria-labelledby="plan-item-${position}-title"[\\s\\S]*?</article>`));
  if (!match) throw new Error(`No hay un ítem ${position}`);
  return match[0];
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Pantalla del plan (PLAN-C12)', () => {
  it('muestra los ítems agrupados por etapa con su nombre, tipo, cantidad y propósito', () => {
    const html = view(generationPlan());
    const stages = [...html.matchAll(/<h3 class="overline">([^<]+)<\/h3>/g)].map(([, name]) => name);
    expect(stages).toEqual(['Enganchar', 'Explicar', 'Evaluar']);

    const explanation = itemArticle(html, 2);
    expect(explanation).toContain('<h4 class="title" id="plan-item-2-title">Explicación</h4>');
    expect(explanation).toMatch(/<option value="2" selected="">2<\/option>/);
    expect(explanation).toContain('Explicar cómo TCP controla el flujo</textarea>');
    expect(html).toContain('Borrador · versión 3');
  });

  it('los conceptos propios se editan y los de otros ítems son de solo lectura', () => {
    const explanation = itemArticle(view(generationPlan()), 2);
    expect(explanation).toContain('aria-label="Mover «control de flujo» a otro ítem"');
    expect(explanation).toContain('aria-label="Quitar «datagrama UDP»"');
    expect(explanation).toMatch(/<option value="item-3">Ítem 3: Ítem de opción múltiple<\/option>/);
    expect(explanation).toContain('Nuevo concepto');

    const readOnly = explanation.match(/Conceptos de otros ítems \(solo lectura\)<\/p><p class="muted">([^<]+)<\/p>/);
    expect(readOnly?.[1]).toBe('entrega fiable · puerto de origen');
    expect(explanation).not.toContain('Mover «entrega fiable»');
  });

  it('muestra los fragmentos de cada ítem con su texto y la evidencia completa', () => {
    const html = view(generationPlan());
    expect(itemArticle(html, 1)).toContain('<blockquote>TCP garantiza la entrega fiable con acuses de recibo.</blockquote>');
    expect(itemArticle(html, 1)).not.toContain('<blockquote>UDP envía datagramas');
    expect(itemArticle(html, 3)).toContain('<blockquote>UDP envía datagramas sin conexión previa.</blockquote>');
    expect(html).toContain('Evidencia del plan (2 fragmentos)');
  });

  it('muestra los referentes, las tipologías anteriores y el aviso de tipología repetida', () => {
    const html = view(generationPlan({ warnings: ['SAME_TYPOLOGY_AS_LAST_SESSION'] }));
    expect(text(html)).toContain('Andrew Tanenbaum : Autor de Redes de computadoras (citado en 1 fragmento)');
    expect(text(html)).toContain('Sesión 2 (15 de noviembre de 2026): Pregunta detonante, Glosario');
    expect(html).toContain('data-notice="same-typology"');
    expect(text(html)).toContain('los mismos de la sesión anterior («Sesión 2»)');
  });

  it('sin referentes, tipologías ni avisos no muestra esas secciones', () => {
    const html = view(generationPlan({ referents: [], sessionContext: { previousTypologies: [] } }));
    expect(html).not.toContain('Referentes');
    expect(html).not.toContain('Tipologías de sesiones anteriores');
    expect(html).not.toContain('data-notice="same-typology"');
    expect(html).not.toContain('data-notice="plan-rules"');
  });

  it('avisa cuando el plan lo armó el planificador por reglas, con el motivo y los intentos', () => {
    const rules = view(generationPlan({ generator: { description: 'Reglas', usesAi: false, fallback: false, fallbackReason: null, attempts: 0 } }));
    expect(rules).toContain('data-notice="plan-rules"');
    expect(text(rules)).toContain('Este plan lo armó el planificador por reglas, sin IA.');
    expect(rules).not.toContain('data-notice="plan-attempts"');

    const fallback = view(generationPlan({
      generator: { description: 'Reglas', usesAi: false, fallback: true, fallbackReason: 'El servicio de IA no respondió a tiempo.', attempts: 2 },
    }));
    expect(text(fallback)).toContain('La IA no pudo armar el plan');
    expect(text(fallback)).toContain('Motivo: El servicio de IA no respondió a tiempo.');
    expect(text(fallback)).toContain('Se pidió el plan a la IA 2 veces.');
  });
});

describe('Propósito que menciona conceptos de otro ítem', () => {
  it('avisa debajo del propósito, sin cambiarlo, cuando cita un concepto que es de otro ítem', () => {
    const purpose = 'Explicar el «control de flujo» y el «puerto de origen» con ejemplos de «Redes»';
    const html = view(generationPlan({
      items: generationPlan().items.map((item) => (item.position === 2 ? { ...item, purpose } : item)),
    }));
    const explanation = itemArticle(html, 2);

    expect(explanation).toContain(`${purpose}</textarea>`);
    expect(explanation).toContain('aria-describedby="plan-item-2-purpose-hint"');
    expect(explanation).toMatch(
      /<p class="field__hint generation-plan__purpose-hint" id="plan-item-2-purpose-hint" data-notice="purpose-stale-concepts">El propósito menciona conceptos que ya no son de este ítem: «puerto de origen»\.<\/p>/,
    );
    // El aviso queda fuera de la etiqueta: no se suma al nombre accesible del campo.
    expect(explanation).toMatch(/<\/textarea><\/label><p class="field__hint generation-plan__purpose-hint"/);
  });

  it('no avisa si el propósito solo cita conceptos propios', () => {
    const html = view(generationPlan());
    expect(html).not.toContain('data-notice="purpose-stale-concepts"');
    expect(itemArticle(html, 2)).not.toContain('plan-item-2-purpose-hint');
  });
});

describe('Problemas junto a cada ítem', () => {
  it('muestra cada problema de validación en su ítem y los del plan arriba', () => {
    const html = view(generationPlan({
      validation: {
        valid: false,
        problems: [
          { code: 'ITEM_WITHOUT_EVIDENCE', message: 'Este ítem no cita ningún fragmento.', itemPosition: 2 },
          { code: 'CONCEPT_OWNED_TWICE', message: '«puerto de origen» está en dos ítems.', itemPosition: 3 },
          { code: 'TOO_MANY_TYPES', message: 'El plan tiene más de 8 tipos.', itemPosition: null },
        ],
      },
    }));
    expect(itemArticle(html, 2)).toContain('<li>Este ítem no cita ningún fragmento.</li>');
    expect(itemArticle(html, 2)).toContain('aria-describedby="plan-item-2-problems"');
    expect(itemArticle(html, 3)).toContain('«puerto de origen» está en dos ítems.');
    expect(itemArticle(html, 1)).not.toContain('generation-plan__problems');
    expect(html).toMatch(/aria-label="Problemas del plan"><li>El plan tiene más de 8 tipos\.<\/li>/);
  });

  it('con PLAN_INVALID al aprobar, muestra los problemas del error junto a sus ítems', () => {
    const error: GenerationError = {
      kind: 'planInvalid', message: 'El plan tiene problemas.',
      problems: [{ code: 'NOT_ENOUGH_CONCEPTS', message: 'Faltan conceptos para 2 recursos.', itemPosition: 2 }],
    };
    const html = view(generationPlan(), { error });
    expect(itemArticle(html, 2)).toContain('Faltan conceptos para 2 recursos.');
    expect(text(html)).toContain('Corrige los problemas marcados junto a cada ítem y vuelve a aprobar.');
  });
});

describe('Aprobar y generar (PLAN-C13)', () => {
  it('borrador válido: se aprueba, «Generar» deshabilitado', () => {
    const html = view(generationPlan());
    expect(isDisabled(html, 'Aprobar plan')).toBe(false);
    expect(isDisabled(html, 'Generar')).toBe(true);
    expect(isDisabled(html, 'Guardar cambios')).toBe(true);
    expect(text(html)).toContain('Aprueba el plan para habilitar «Generar».');
  });

  it('borrador inválido: no se aprueba ni se genera', () => {
    const html = view(generationPlan({ validation: { valid: false, problems: [] } }));
    expect(isDisabled(html, 'Aprobar plan')).toBe(true);
    expect(isDisabled(html, 'Generar')).toBe(true);
  });

  it('aprobado: «Generar» habilitado', () => {
    const html = view(generationPlan({ status: 'approved', approvedAt: '2026-11-22T11:00:00Z' }));
    expect(isDisabled(html, 'Generar')).toBe(false);
    expect(isDisabled(html, 'Aprobar plan')).toBe(true);
    expect(html).toContain('Aprobado · versión 3');
  });

  it('mientras se envía el pedido o se guarda, nada se habilita', () => {
    const generating = view(generationPlan({ status: 'approved' }), { generating: true });
    expect(isDisabled(generating, 'Generar')).toBe(true);
    expect(text(generating)).toContain('Enviando el pedido de generación…');

    const saving = view(generationPlan(), { busy: 'saving' });
    expect(isDisabled(saving, 'Aprobar plan')).toBe(true);
    expect(text(saving)).toContain('Guardando…');
  });

  it('un plan usado no se edita ni se genera', () => {
    const html = view(generationPlan({ status: 'used', usedByRequestId: 'gen-req-1' }));
    expect(isDisabled(html, 'Generar')).toBe(true);
    expect(button(html, 'Quitar ítem')).toContain('disabled=""');
    expect(html).not.toContain('Agregar un ítem');
  });
});

describe('Conflictos y material que cambió', () => {
  it('PLAN_VERSION_CONFLICT ofrece recargar el plan', () => {
    const html = view(generationPlan(), { error: { kind: 'planVersionConflict', message: 'Este plan cambió.' } });
    expect(html).toContain('Este plan cambió.');
    expect(text(html)).toContain('los cambios sin guardar se pierden');
    expect(isDisabled(html, 'Recargar el plan')).toBe(false);
  });

  it('PLAN_EVIDENCE_STALE al generar explica qué documentos cambiaron y ofrece planificar de nuevo', () => {
    const error: GenerationError = {
      kind: 'planEvidenceStale', message: 'El material del plan cambió. Crea un plan nuevo.',
      staleDocuments: [{ documentId: 'doc-1', documentName: 'protocolos.pdf', missingFragmentIds: ['frag-1', 'frag-2'] }],
    };
    const html = render(<StartErrorNotice error={error} submitting={false} onRetry={noop} onStartFresh={noop} onReplan={noop} />);
    expect(html).toContain('El material del plan cambió. Crea un plan nuevo.');
    expect(html).toContain('<li>protocolos.pdf (faltan 2 fragmentos)</li>');
    expect(text(html)).toContain('No se creó ningún pedido.');
    expect(isDisabled(html, 'Planificar de nuevo')).toBe(false);
  });

  it('PLAN_VERSION_CONFLICT al generar también ofrece recargar el plan', () => {
    const html = render(<StartErrorNotice error={{ kind: 'planVersionConflict', message: 'El plan cambió.' }} submitting={false}
      onRetry={noop} onStartFresh={noop} onReloadPlan={noop} />);
    expect(isDisabled(html, 'Recargar el plan')).toBe(false);
  });

  it('PLAN_REQUIRED pide planificar primero, con un botón para hacerlo con los mismos datos', () => {
    const html = render(<StartErrorNotice error={{ kind: 'planRequired', message: 'Falta el plan.' }} submitting={false}
      onRetry={noop} onStartFresh={noop} onPlan={noop} />);
    expect(text(html)).toContain('Antes de generar hay que preparar un plan y aprobarlo.');
    expect(isDisabled(html, 'Planificar con estos datos')).toBe(false);
  });
});

describe('Recargar la pantalla (PLAN-C14)', () => {
  it('el plan recuperado de la lista se muestra con sus cambios guardados', async () => {
    const saved = generationPlan({
      version: 5,
      items: generationPlan().items.map((item) => (item.position === 2 ? { ...item, purpose: 'Propósito editado y guardado', covers: ['control de flujo', 'ventana deslizante'] } : item)),
    });
    const restored = await recoverLatestPlan(async () => [saved]);
    expect(restored).not.toBeNull();

    const html = view(restored!);
    expect(html).toContain('Borrador · versión 5');
    expect(itemArticle(html, 2)).toContain('Propósito editado y guardado</textarea>');
    expect(itemArticle(html, 2)).toContain('ventana deslizante');
    expect(isDisabled(html, 'Guardar cambios')).toBe(true);
  });
});

describe('«Planificar» como acción principal del formulario', () => {
  const catalog = { types: planTypes, loading: false, error: '', reload: noop };

  it('el botón principal es «Planificar» y el formulario no ofrece «Generar»', () => {
    const html = render(<GenerationForm unit={unit} catalog={catalog} onPlan={noop}
      initialValue={{ ...initialGenerationForm, resourceTypes: ['explicacion'] }} />);
    const buttons = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(([, label]) => label);

    expect(html).toMatch(/<button[^>]*class="btn btn--primary" type="submit"[^>]*>Planificar<\/button>/);
    expect(buttons.filter((label) => /Generar/.test(label))).toEqual([]);
    expect(text(html)).toContain('Después lo revisas, lo apruebas y generas desde el plan.');
  });

  it('mientras se arma el plan, el formulario queda bloqueado', () => {
    const html = render(<GenerationForm unit={unit} catalog={catalog} onPlan={noop} planning
      initialValue={{ ...initialGenerationForm, resourceTypes: ['explicacion'] }} />);
    expect(isDisabled(html, 'Armando el plan…')).toBe(true);
    expect(html).toMatch(/<fieldset class="generation-fieldset" disabled="">/);
  });

  it('el formulario no tiene ninguna salida para enviar un pedido sin plan', () => {
    const props: Parameters<typeof GenerationForm>[0] = {
      unit,
      catalog,
      onPlan: noop,
      // @ts-expect-error El formulario solo pide planes: no acepta un callback para enviar pedidos de generación.
      onSubmit: noop,
    };
    expect(Object.keys(props)).toContain('onPlan');
  });
});

describe('Ningún texto menciona la metodología (PLAN-R8)', () => {
  it('los textos de la pantalla de Generación no dicen «5E»', () => {
    const plan = generationPlan({
      warnings: ['SAME_TYPOLOGY_AS_LAST_SESSION'],
      validation: { valid: false, problems: [{ code: 'PLAN_EMPTY', message: 'Agrega un ítem.', itemPosition: null }] },
      generator: { description: 'Reglas', usesAi: false, fallback: true, fallbackReason: 'Sin respuesta', attempts: 2 },
      evidence: { ...generationPlan().evidence, retrievalMode: 'bm25_fallback' },
    });
    const errors: GenerationError[] = [
      'planVersionConflict', 'planInvalid', 'planEvidenceStale', 'planAlreadyUsed', 'planNotApproved', 'planNotFound',
      'planRequired', 'network', 'keyReused', 'tooManyActive', 'noMaterial',
    ].map((kind) => ({ kind, message: 'Mensaje del servidor.', staleDocuments: [] }) as GenerationError);
    const catalog = { types: planTypes, loading: false, error: '', reload: noop };
    const screens = [
      view(plan),
      view(generationPlan({ status: 'approved' }), { busy: 'creating' }),
      render(<GenerationForm unit={unit} catalog={catalog} onPlan={noop} />),
      render(<GenerationPreview preview={previewFromRequest({ mode: 'sequence', unitId: unit.id, resourceTypes: ['explicacion'] }, unit, planTypes)}
        onConfirm={noop} onEdit={noop} />),
      render(<GenerationProgress resourceTypes={planTypes} request={{
        id: 'r', mode: 'sequence', unitId: unit.id, status: 'running', resourceTypes: ['explicacion'], createdAt: '2026-11-22T10:00:00Z',
        parameters: { resourceTypes: ['explicacion'], quantity: 1, difficulty: 'intermedia', optionCount: 4, topK: 10, evidenceThreshold: 0.6, instructions: '', audience: '', competency: '', modalities: [] },
        steps: [{ position: 0, stage: 'explain', resourceType: 'explicacion', agent: 'Agente de Explicar', status: 'running', resourceIds: [], rejections: [] }],
      }} />),
      render(<FallbackNotices retrievalMode="bm25_fallback" resourceTypes={planTypes} steps={[{
        position: 0, stage: 'explain', resourceType: 'explicacion', agent: 'Agente', status: 'succeeded', resourceIds: [], rejections: [],
        generator: { description: 'Reglas', usesAi: false, fallback: true },
      }]} />),
      ...errors.map((error) => view(plan, { error })),
      ...errors.map((error) => render(<StartErrorNotice error={error} submitting={false} onRetry={noop} onStartFresh={noop}
        onReloadPlan={noop} onReplan={noop} onPlan={noop} onClosePlan={noop} />)),
    ];
    for (const html of screens) {
      expect(html).not.toMatch(/\b5\s?E\b/);
      expect(text(html)).not.toMatch(/metodolog[ií]a|modelo 5/i);
    }
    // Los nombres de las etapas sí se muestran.
    expect(text(screens[0])).toContain('Enganchar');
  });
});
