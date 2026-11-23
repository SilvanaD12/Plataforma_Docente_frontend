import { describe, expect, it } from 'vitest';
import { generationPlan, planItem, planTypes } from '../testing/planFixtures';
import {
  addConcept, addItem, conceptsOfOtherItems, draftItems, groupItemsByStage, latestOpenPlan, localItemProblems,
  moveConcept, planActions, planLevelLocalProblem, planRequestFromGenerationBody, planRequestFromInputs, planUpdateBody,
  problemsByItem, removeConcept, removeItem, sameItems, setPurpose, setQuantity, staleConceptMentions, toggleFragment, type DraftPlanItem,
} from './generationPlan';

const keyOf = (items: DraftPlanItem[], type: string) => items.find(({ resourceType }) => resourceType === type)!.key;

describe('Mover conceptos entre ítems', () => {
  it('pasa el concepto al final del destino y lo quita del origen', () => {
    const items = draftItems(generationPlan());
    const moved = moveConcept(items, keyOf(items, 'explicacion'), 'datagrama UDP', keyOf(items, 'item_opcion_multiple'));

    expect(moved.find(({ resourceType }) => resourceType === 'explicacion')!.covers).toEqual(['control de flujo']);
    expect(moved.find(({ resourceType }) => resourceType === 'item_opcion_multiple')!.covers).toEqual(['puerto de origen', 'datagrama UDP']);
    expect(conceptsOfOtherItems(moved, keyOf(moved, 'item_opcion_multiple'))).toEqual(['entrega fiable', 'control de flujo']);
  });

  it('si el destino ya tiene el concepto (sin importar mayúsculas), solo lo quita del origen', () => {
    const items = draftItems(generationPlan({
      items: [planItem(1, { covers: ['Control de flujo'] }), planItem(2, { resourceType: 'glosario', covers: ['control  de flujo', 'ventana'] })],
    }));
    const moved = moveConcept(items, 'item-1', 'Control de flujo', 'item-2');
    expect(moved[0].covers).toEqual([]);
    expect(moved[1].covers).toEqual(['control  de flujo', 'ventana']);
  });

  it('no cambia nada con el mismo ítem, un ítem inexistente o un concepto ajeno', () => {
    const items = draftItems(generationPlan());
    expect(moveConcept(items, 'item-2', 'control de flujo', 'item-2')).toBe(items);
    expect(moveConcept(items, 'item-2', 'control de flujo', 'item-99')).toBe(items);
    expect(moveConcept(items, 'item-2', 'entrega fiable', 'item-3')).toBe(items);
  });
});

describe('Edición del borrador', () => {
  it('agrega conceptos normalizados sin repetirlos y los quita', () => {
    let items = draftItems(generationPlan());
    items = addConcept(items, 'item-1', '  acuse   de recibo ');
    items = addConcept(items, 'item-1', 'ENTREGA FIABLE');
    items = addConcept(items, 'item-1', '   ');
    expect(items[0].covers).toEqual(['entrega fiable', 'acuse de recibo']);
    expect(removeConcept(items, 'item-1', 'entrega fiable')[0].covers).toEqual(['acuse de recibo']);
  });

  it('cambia propósito, cantidad y fragmentos solo del ítem indicado', () => {
    let items = draftItems(generationPlan());
    items = setPurpose(items, 'item-2', 'Nuevo propósito');
    items = setQuantity(items, 'item-2', 1);
    items = toggleFragment(items, 'item-2', 'frag-1');
    items = toggleFragment(items, 'item-3', 'frag-1');
    expect(items[1]).toMatchObject({ purpose: 'Nuevo propósito', quantity: 1, fragmentIds: ['frag-2'] });
    expect(items[2].fragmentIds).toEqual(['frag-2', 'frag-1']);
    expect(items[0]).toMatchObject({ purpose: 'Despertar la curiosidad por la entrega fiable', fragmentIds: ['frag-1'] });
  });

  it('agrega un ítem al final de su etapa y lo quita', () => {
    const items = addItem(draftItems(generationPlan()), 'glosario', planTypes, 'new-1');
    expect(items.map(({ resourceType }) => resourceType)).toEqual(['pregunta_detonante', 'explicacion', 'glosario', 'item_opcion_multiple']);
    expect(items[2]).toMatchObject({ key: 'new-1', stage: 'explain', savedPosition: null, quantity: 1, purpose: '', covers: [], fragmentIds: [] });
    expect(removeItem(items, 'new-1').map(({ key }) => key)).toEqual(['item-1', 'item-2', 'item-3']);
  });

  it('agrupa por etapa con el nombre de la etapa disponible para la pantalla', () => {
    const groups = groupItemsByStage(addItem(draftItems(generationPlan()), 'glosario', planTypes, 'new-1'));
    expect(groups.map(({ stage, items }) => [stage, items.map(({ resourceType }) => resourceType)])).toEqual([
      ['engage', ['pregunta_detonante']],
      ['explain', ['explicacion', 'glosario']],
      ['evaluate', ['item_opcion_multiple']],
    ]);
  });
});

describe('Cuerpo del PUT', () => {
  it('lleva expectedVersion y los ítems en orden de etapa, sin stage ni doesNotCover', () => {
    const plan = generationPlan();
    let items = draftItems(plan);
    items = addItem(items, 'pregunta_detonante', planTypes, 'new-1');
    items = setPurpose(items, 'new-1', '  Otra pregunta  ');
    items = addConcept(items, 'new-1', 'segmento TCP');

    const body = planUpdateBody(plan.version, items);
    expect(body.expectedVersion).toBe(3);
    expect(body.items.map(({ resourceType }) => resourceType)).toEqual(['pregunta_detonante', 'pregunta_detonante', 'explicacion', 'item_opcion_multiple']);
    expect(body.items[1]).toEqual({ resourceType: 'pregunta_detonante', quantity: 1, purpose: 'Otra pregunta', covers: ['segmento TCP'], fragmentIds: [] });
    expect(Object.keys(body.items[0]).sort()).toEqual(['covers', 'fragmentIds', 'purpose', 'quantity', 'resourceType']);
  });

  it('sin cambios, el borrador es igual al plan guardado', () => {
    const plan = generationPlan();
    expect(sameItems(draftItems(plan), draftItems(plan))).toBe(true);
    expect(sameItems(draftItems(plan), setPurpose(draftItems(plan), 'item-1', 'Otro'))).toBe(false);
  });
});

describe('Problemas', () => {
  it('bloquea guardar lo que el servidor rechazaría por esquema y lo marca en su ítem', () => {
    let items = draftItems(generationPlan());
    items = setPurpose(items, 'item-1', '   ');
    items = removeConcept(items, 'item-3', 'puerto de origen');
    items = addConcept(items, 'item-2', 'x'.repeat(121));
    const problems = localItemProblems(items);
    expect(problems.get('item-1')).toEqual(['Escribe el propósito del ítem.']);
    expect(problems.get('item-3')).toEqual(['El ítem necesita al menos un concepto propio.']);
    expect(problems.get('item-2')).toEqual(['Cada concepto admite hasta 120 caracteres.']);
    expect(planLevelLocalProblem(items)).toBeNull();
  });

  it('une los problemas del servidor a su ítem guardado aunque se quite otro ítem', () => {
    const items = removeItem(draftItems(generationPlan()), 'item-1');
    const { general, byKey } = problemsByItem([
      { code: 'PLAN_EMPTY', message: 'General', itemPosition: null },
      { code: 'ITEM_WITHOUT_EVIDENCE', message: 'Sin fragmentos', itemPosition: 3 },
      { code: 'PURPOSE_REQUIRED', message: 'Del ítem quitado', itemPosition: 1 },
    ], items);
    expect(byKey.get('item-3')?.map(({ message }) => message)).toEqual(['Sin fragmentos']);
    expect(general.map(({ message }) => message)).toEqual(['General', 'Del ítem quitado']);
  });
});

describe('Acciones según el estado', () => {
  const idle = { dirty: false, busy: false, blocked: false };

  it('borrador válido: se aprueba, pero no se genera', () => {
    expect(planActions(generationPlan(), idle)).toEqual({ canEdit: true, canSave: false, canApprove: true, canGenerate: false });
  });

  it('borrador inválido o con cambios sin guardar: no se aprueba', () => {
    expect(planActions(generationPlan({ validation: { valid: false, problems: [] } }), idle).canApprove).toBe(false);
    expect(planActions(generationPlan(), { ...idle, dirty: true })).toMatchObject({ canSave: true, canApprove: false });
    expect(planActions(generationPlan(), { ...idle, dirty: true, blocked: true }).canSave).toBe(false);
  });

  it('aprobado: «Generar» se habilita; con cambios sin guardar, no', () => {
    const approved = generationPlan({ status: 'approved' });
    expect(planActions(approved, idle)).toMatchObject({ canApprove: false, canGenerate: true });
    expect(planActions(approved, { ...idle, dirty: true }).canGenerate).toBe(false);
    expect(planActions(approved, { ...idle, busy: true }).canGenerate).toBe(false);
  });

  it('usado: nada se edita ni se genera', () => {
    expect(planActions(generationPlan({ status: 'used' }), { ...idle, dirty: true })).toEqual({
      canEdit: false, canSave: false, canApprove: false, canGenerate: false,
    });
  });
});

describe('Crear y recuperar el plan', () => {
  it('pide el plan con los mismos datos que el cuerpo de generación del formulario', () => {
    expect(planRequestFromGenerationBody({
      mode: 'sequence', unitId: 'unidad-1', resourceTypes: ['pregunta_detonante', 'item_opcion_multiple'], quantity: 2,
      outcomeId: 'ra-1', audience: 'Tercer ciclo', instructions: 'TCP y UDP', modalities: ['Gamificado'],
    })).toEqual({
      unitId: 'unidad-1', instructions: 'TCP y UDP', audience: 'Tercer ciclo', competency: '', outcomeId: 'ra-1',
      modality: 'Gamificado',
      resourceTypes: [{ type: 'pregunta_detonante', quantity: 2 }, { type: 'item_opcion_multiple', quantity: 2 }],
    });
    expect(planRequestFromGenerationBody({ mode: 'individual', unitId: 'u', resourceTypes: ['glosario'] })).toMatchObject({
      modality: null, outcomeId: null, resourceTypes: [{ type: 'glosario', quantity: null }],
    });
  });

  it('vuelve a planificar con las entradas guardadas del plan', () => {
    const plan = generationPlan();
    expect(planRequestFromInputs(plan.unitId, plan.inputs)).toEqual({
      unitId: 'unidad-1', instructions: 'Diferencias entre TCP y UDP', audience: 'Tercer ciclo', competency: 'Pensamiento crítico',
      outcomeId: 'ra-1', modality: 'Textual', resourceTypes: plan.inputs.resourceTypes, difficulty: 'intermedia',
      optionCount: 4, evidenceThreshold: 0.6, topK: 12,
    });
  });

  it('recupera el plan más reciente si sigue en borrador o aprobado', () => {
    const older = generationPlan({ id: 'viejo', updatedAt: '2026-11-20T00:00:00Z' });
    const newest = generationPlan({ id: 'nuevo', updatedAt: '2026-11-22T00:00:00Z', status: 'approved' });
    expect(latestOpenPlan([older, newest])?.id).toBe('nuevo');
    expect(latestOpenPlan([older, { ...newest, status: 'used' }])).toBeNull();
    expect(latestOpenPlan([{ ...newest, origin: 'implicit' }])).toBeNull();
    expect(latestOpenPlan([])).toBeNull();
  });
});

describe('Propósito que menciona conceptos ajenos', () => {
  const purpose = 'Explicar «control de flujo» y el «datagrama UDP» con ejemplos de «Redes»';

  function mentionsAfter(change: (items: DraftPlanItem[]) => DraftPlanItem[]) {
    const saved = draftItems(generationPlan());
    const items = change(setPurpose(saved, 'item-2', purpose));
    const item = items.find(({ key }) => key === 'item-2')!;
    const savedCovers = saved.find(({ key }) => key === 'item-2')!.covers;
    return staleConceptMentions(item.purpose, item.covers, [...savedCovers, ...conceptsOfOtherItems(items, 'item-2')]);
  }

  it('señala un concepto citado que se movió a otro ítem', () => {
    expect(mentionsAfter((items) => moveConcept(items, 'item-2', 'datagrama UDP', 'item-3'))).toEqual(['datagrama UDP']);
  });

  it('señala un concepto citado que se quitó del ítem', () => {
    expect(mentionsAfter((items) => removeConcept(items, 'item-2', 'control de flujo'))).toEqual(['control de flujo']);
  });

  it('no señala conceptos propios ni citas que no son conceptos del plan', () => {
    expect(mentionsAfter((items) => items)).toEqual([]);
  });

  it('compara sin distinguir mayúsculas ni espacios y no repite el aviso', () => {
    expect(staleConceptMentions('«Puerto  de origen» y otra vez «puerto de origen»', ['control de flujo'], ['puerto de origen']))
      .toEqual(['Puerto de origen']);
    expect(staleConceptMentions('Sin citas', [], ['puerto de origen'])).toEqual([]);
  });
});
