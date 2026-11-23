import { useMemo, useRef, useState } from 'react';
import type { Unit } from '../../../shared/types/courses';
import type { PlanBusy } from '../hooks/useGenerationPlan';
import type { GenerationError } from '../model/generationErrors';
import {
  addConcept, addItem, conceptsOfOtherItems, draftItems, groupItemsByStage, localItemProblems, moveConcept,
  orderByStage, planActions, planLevelLocalProblem, planStatusLabel, planUpdateBody, problemsByItem, removeConcept,
  removeItem, sameItems, setPurpose, setQuantity, staleConceptMentions, toggleFragment,
  maxConceptLength, maxPurposeLength,
  type DraftPlanItem, type GenerationPlan, type PlanFragment, type UpdateGenerationPlan,
} from '../model/generationPlan';
import { maxQuantity, minQuantity, stageLabel } from '../model/generationRequest';
import { hasModalityCatalog, typeName, typesForModality, type ResourceTypeInfo } from '../model/resourceTypes';
import { PlanErrorDetails } from './PlanErrorDetails';
import '../generation.css';

interface GenerationPlanViewProps {
  plan: GenerationPlan;
  unit: Unit;
  resourceTypes: ResourceTypeInfo[];
  busy?: PlanBusy;
  /** Se está enviando el pedido de generación con este plan. */
  generating?: boolean;
  /** Error de la última acción sobre el plan (guardar, aprobar o recargar). */
  error?: GenerationError | null;
  onSave: (body: UpdateGenerationPlan) => void;
  onApprove: () => void;
  onGenerate: () => void;
  onReload: () => void;
  onReplan: () => void;
  onClose: () => void;
}

const quantities = Array.from({ length: maxQuantity - minQuantity + 1 }, (_, index) => minQuantity + index);

const busyLabels: Record<Exclude<PlanBusy, null>, string> = {
  creating: 'Armando el plan…',
  saving: 'Guardando…',
  approving: 'Aprobando…',
  reloading: 'Recargando…',
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/**
 * Revisión, edición y aprobación del plan (GEN-P3). Quien lo usa le pone `key` con el id, la versión y el estado del
 * plan: tras guardar o aprobar, la edición local vuelve a partir de lo que respondió el servidor.
 */
export function GenerationPlanView({
  plan, unit, resourceTypes, busy = null, generating = false, error = null,
  onSave, onApprove, onGenerate, onReload, onReplan, onClose,
}: GenerationPlanViewProps) {
  const saved = useMemo(() => draftItems(plan), [plan]);
  const [items, setItems] = useState(saved);
  const [conceptDrafts, setConceptDrafts] = useState<Record<string, string>>({});
  const [newType, setNewType] = useState('');
  const nextKey = useRef(1);

  const working = busy !== null || generating;
  const dirty = !sameItems(items, saved);
  const localProblems = localItemProblems(items);
  const planProblem = planLevelLocalProblem(items);
  const blocked = localProblems.size > 0 || planProblem !== null;
  const actions = planActions(plan, { dirty, busy: working, blocked });
  const serverProblems = error?.kind === 'planInvalid' && error.problems?.length ? error.problems : plan.validation.problems;
  const { general, byKey } = problemsByItem(serverProblems, items);
  const fragments = new Map(plan.evidence.fragments.map((fragment) => [fragment.id, fragment]));
  const numbered = orderByStage(items).map((item, index) => ({ item, number: index + 1 }));
  const numberOf = (key: string) => numbered.find(({ item }) => item.key === key)?.number ?? 0;
  const itemLabel = (item: DraftPlanItem) => `Ítem ${numberOf(item.key)}: ${typeName(resourceTypes, item.resourceType)}`;
  const addableTypes = plan.inputs.modality && hasModalityCatalog(resourceTypes)
    ? typesForModality(resourceTypes, plan.inputs.modality)
    : resourceTypes;
  const [lastSession] = plan.sessionContext.previousTypologies;
  const ruleBased = !plan.generator.usesAi || plan.generator.fallback;
  const context: [string, string][] = ([
    ['Tema', plan.inputs.instructions],
    ['Audiencia', plan.inputs.audience],
    ['Competencia', plan.inputs.competency],
    ['Resultado de aprendizaje', outcomeText(unit, plan.inputs.outcomeId)],
    ['Modalidad', plan.inputs.modality ?? ''],
  ] as [string, string][]).filter(([, value]) => value.trim());

  function save() {
    if (actions.canSave) onSave(planUpdateBody(plan.version, items));
  }

  function addOwnConcept(key: string) {
    setItems((current) => addConcept(current, key, conceptDrafts[key] ?? ''));
    setConceptDrafts((current) => ({ ...current, [key]: '' }));
  }

  function addNewItem() {
    if (!newType) return;
    setItems((current) => addItem(current, newType, resourceTypes, 'new-' + nextKey.current++));
    setNewType('');
  }

  return (
    <section className="card generation-plan" aria-labelledby="generation-plan-title" aria-busy={working}>
      <header className="generation-progress__head">
        <div className="stack generation-plan__heading">
          <h2 className="h2" id="generation-plan-title">Plan de generación</h2>
          <p className="muted">
            Revisa qué se va a generar, para qué sirve cada recurso y en qué fragmentos del material se apoya.
            Guarda tus cambios y aprueba el plan para generar.
          </p>
        </div>
        <span className={'generation-badge generation-badge--plan-' + plan.status} role="status">
          {planStatusLabel(plan.status)} · versión {plan.version}
        </span>
      </header>

      {context.length > 0 && (
        <dl className="generation-preview__facts">
          {context.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}

      {ruleBased && (
        <div className="alert alert--warn" data-notice="plan-rules">
          <p>
            <strong>Plan armado con reglas.</strong>{' '}
            {plan.generator.fallback
              ? 'La IA no pudo armar el plan y se usó el planificador por reglas. Revisa los propósitos y conceptos con más atención.'
              : 'Este plan lo armó el planificador por reglas, sin IA.'}
            {plan.generator.fallbackReason && <> Motivo: {plan.generator.fallbackReason}</>}
          </p>
        </div>
      )}
      {plan.generator.attempts !== undefined && plan.generator.attempts > 0 && (
        <p className="field__hint" data-notice="plan-attempts">
          {plan.generator.attempts === 1 ? 'Se pidió el plan a la IA 1 vez.' : `Se pidió el plan a la IA ${plan.generator.attempts} veces.`}
        </p>
      )}
      {plan.evidence.retrievalMode === 'bm25_fallback' && (
        <p className="alert">La búsqueda en el material usó solo palabras clave. Comprueba que los fragmentos sean pertinentes.</p>
      )}
      {plan.warnings.includes('SAME_TYPOLOGY_AS_LAST_SESSION') && (
        <div className="alert alert--warn" data-notice="same-typology">
          <p>
            <strong>Tipología repetida.</strong>{' '}
            Los tipos de este plan son los mismos de la sesión anterior
            {lastSession ? <> («{lastSession.sessionLabel}»)</> : null}. Considera variar algún tipo de recurso.
          </p>
        </div>
      )}

      {error && (
        <div className="alert alert--warn" role="alert">
          <div className="stack generation-notice">
            <p>{error.message}</p>
            <PlanErrorDetails error={error} busy={working} onReload={onReload} onReplan={onReplan} onClose={onClose} />
          </div>
        </div>
      )}

      {(general.length > 0 || planProblem) && (
        <ul className="generation-plan__problems" aria-label="Problemas del plan">
          {planProblem && <li>{planProblem}</li>}
          {general.map((problem, index) => <li key={problem.code + index}>{problem.message}</li>)}
        </ul>
      )}

      {items.length === 0 && <p className="muted">El plan no tiene ítems. Agrega al menos uno para poder aprobarlo.</p>}

      {groupItemsByStage(items).map(({ stage, items: stageItems }) => (
        <section className="stack generation-plan__stage" key={stage ?? 'none'} aria-label={stage ? stageLabel(stage) : 'Sin etapa'}>
          <h3 className="overline">{stage ? stageLabel(stage) : 'Sin etapa'}</h3>
          {stageItems.map((item) => {
            const problems = [...(localProblems.get(item.key) ?? []), ...(byKey.get(item.key) ?? []).map(({ message }) => message)];
            const problemsId = `plan-${item.key}-problems`;
            const others = conceptsOfOtherItems(items, item.key);
            const savedCovers = saved.find(({ key }) => key === item.key)?.covers ?? [];
            const staleMentions = staleConceptMentions(item.purpose, item.covers, [...savedCovers, ...others]);
            const purposeHintId = `plan-${item.key}-purpose-hint`;
            const otherItems = items.filter(({ key }) => key !== item.key);
            return (
              <article className="generation-step generation-plan__item" key={item.key} aria-labelledby={`plan-${item.key}-title`}
                aria-describedby={problems.length ? problemsId : undefined}>
                <div className="generation-step__head">
                  <div>
                    <p className="overline">Ítem {numberOf(item.key)}</p>
                    <h4 className="title" id={`plan-${item.key}-title`}>{typeName(resourceTypes, item.resourceType)}</h4>
                  </div>
                  <div className="course-actions">
                    <label className="field generation-plan__quantity">
                      <span className="field__label">Cantidad</span>
                      <select className="input" value={item.quantity} disabled={!actions.canEdit}
                        onChange={(event) => setItems((current) => setQuantity(current, item.key, Number(event.target.value)))}>
                        {quantities.map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
                      </select>
                    </label>
                    <button className="btn" type="button" disabled={!actions.canEdit}
                      onClick={() => setItems((current) => removeItem(current, item.key))}>
                      Quitar ítem
                    </button>
                  </div>
                </div>

                {problems.length > 0 && (
                  <ul className="generation-plan__problems" id={problemsId} aria-label={`Problemas del ítem ${numberOf(item.key)}`}>
                    {problems.map((message, index) => <li key={index}>{message}</li>)}
                  </ul>
                )}

                <label className="field">
                  <span className="field__label">Propósito</span>
                  <textarea className="input course-textarea" rows={2} value={item.purpose} maxLength={maxPurposeLength}
                    disabled={!actions.canEdit} aria-describedby={staleMentions.length ? purposeHintId : undefined}
                    onChange={(event) => setItems((current) => setPurpose(current, item.key, event.target.value))} />
                </label>
                {staleMentions.length > 0 && (
                  <p className="field__hint generation-plan__purpose-hint" id={purposeHintId} data-notice="purpose-stale-concepts">
                    El propósito menciona conceptos que ya no son de este ítem: {staleMentions.map((concept) => `«${concept}»`).join(', ')}.
                  </p>
                )}

                <div className="stack generation-plan__concepts">
                  <p className="field__label">Conceptos propios</p>
                  {item.covers.length === 0 && <p className="field__hint">Este ítem todavía no tiene conceptos.</p>}
                  <ul className="generation-plan__concept-list" aria-label={`Conceptos propios del ítem ${numberOf(item.key)}`}>
                    {item.covers.map((concept) => (
                      <li key={concept} className="generation-plan__concept">
                        <span>{concept}</span>
                        {otherItems.length > 0 && (
                          <select className="input" value="" disabled={!actions.canEdit}
                            aria-label={`Mover «${concept}» a otro ítem`}
                            onChange={(event) => {
                              const target = event.target.value;
                              if (target) setItems((current) => moveConcept(current, item.key, concept, target));
                            }}>
                            <option value="">Mover a…</option>
                            {otherItems.map((other) => <option key={other.key} value={other.key}>{itemLabel(other)}</option>)}
                          </select>
                        )}
                        <button className="btn" type="button" disabled={!actions.canEdit}
                          aria-label={`Quitar «${concept}»`}
                          onClick={() => setItems((current) => removeConcept(current, item.key, concept))}>
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="generation-plan__add">
                    <label className="field">
                      <span className="field__label">Nuevo concepto</span>
                      <input className="input" type="text" value={conceptDrafts[item.key] ?? ''} maxLength={maxConceptLength}
                        disabled={!actions.canEdit}
                        onChange={(event) => setConceptDrafts((current) => ({ ...current, [item.key]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addOwnConcept(item.key);
                          }
                        }} />
                    </label>
                    <button className="btn" type="button" disabled={!actions.canEdit || !(conceptDrafts[item.key] ?? '').trim()}
                      onClick={() => addOwnConcept(item.key)}>
                      Agregar concepto
                    </button>
                  </div>
                </div>

                <div className="stack generation-plan__concepts">
                  <p className="field__label">Conceptos de otros ítems (solo lectura)</p>
                  {others.length
                    ? <p className="muted">{others.join(' · ')}</p>
                    : <p className="field__hint">Ningún otro ítem tiene conceptos.</p>}
                </div>

                <div className="stack generation-plan__fragments">
                  <p className="field__label">Fragmentos que lo respaldan</p>
                  {item.fragmentIds.length === 0 && <p className="field__hint">Este ítem no cita ningún fragmento.</p>}
                  {item.fragmentIds.map((id) => <FragmentQuote key={id} id={id} fragment={fragments.get(id)} />)}
                  {plan.evidence.fragments.length > 0 && (
                    <details>
                      <summary>Cambiar fragmentos</summary>
                      <fieldset className="generation-fieldset" disabled={!actions.canEdit}>
                        <legend className="field__hint">Fragmentos de la evidencia del plan</legend>
                        {plan.evidence.fragments.map((fragment) => (
                          <label className="generation-choice" key={fragment.id}>
                            <input type="checkbox" checked={item.fragmentIds.includes(fragment.id)}
                              onChange={() => setItems((current) => toggleFragment(current, item.key, fragment.id))} />
                            <span>{fragment.documentName} · {fragment.location}</span>
                          </label>
                        ))}
                      </fieldset>
                    </details>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}

      {plan.status !== 'used' && (
        <div className="generation-plan__add">
          <label className="field">
            <span className="field__label">Agregar un ítem</span>
            <select className="input" value={newType} disabled={!actions.canEdit} onChange={(event) => setNewType(event.target.value)}>
              <option value="">Elige un tipo de recurso</option>
              {addableTypes.map((type) => (
                <option key={type.id} value={type.id}>{stageLabel(type.stage)} · {type.name}</option>
              ))}
            </select>
          </label>
          <button className="btn" type="button" disabled={!actions.canEdit || !newType} onClick={addNewItem}>Agregar ítem</button>
        </div>
      )}

      <details className="generation-plan__evidence">
        <summary>Evidencia del plan ({plan.evidence.fragments.length} fragmentos)</summary>
        <div className="stack">
          {plan.evidence.fragments.map((fragment) => <FragmentQuote key={fragment.id} id={fragment.id} fragment={fragment} />)}
        </div>
      </details>

      {plan.referents.length > 0 && (
        <section className="stack generation-plan__context" aria-labelledby="plan-referents-title">
          <h3 className="field__label" id="plan-referents-title">Referentes</h3>
          <ul className="generation-list">
            {plan.referents.map((referent) => (
              <li key={referent.name}>
                <strong>{referent.name}</strong>
                {referent.description && <>: {referent.description}</>}
                {referent.fragmentIds.length > 0 && (
                  <span className="muted"> ({referent.fragmentIds.length === 1 ? 'citado en 1 fragmento' : `citado en ${referent.fragmentIds.length} fragmentos`})</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.sessionContext.previousTypologies.length > 0 && (
        <section className="stack generation-plan__context" aria-labelledby="plan-typologies-title">
          <h3 className="field__label" id="plan-typologies-title">Tipologías de sesiones anteriores</h3>
          <ul className="generation-list">
            {plan.sessionContext.previousTypologies.map((session) => (
              <li key={session.sessionLabel + session.usedAt}>
                <strong>{session.sessionLabel}</strong> ({formatDate(session.usedAt)}):{' '}
                {session.resourceTypes.map((id) => typeName(resourceTypes, id)).join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="stack generation-plan__actions">
        <p className="field__hint" id="plan-actions-hint" role="status">
          {working
            ? (generating ? 'Enviando el pedido de generación…' : busyLabels[busy ?? 'saving'])
            : actionHint(plan, dirty, blocked)}
        </p>
        <div className="course-actions">
          <button className="btn" type="button" disabled={!actions.canSave} aria-busy={busy === 'saving'} onClick={save}>
            Guardar cambios
          </button>
          <button className="btn" type="button" disabled={!dirty || working} onClick={() => setItems(saved)}>
            Descartar cambios
          </button>
          <button className="btn" type="button" disabled={!actions.canApprove} aria-busy={busy === 'approving'} onClick={onApprove}>
            Aprobar plan
          </button>
          <button className="btn btn--primary" type="button" disabled={!actions.canGenerate} aria-busy={generating}
            aria-describedby="plan-actions-hint" onClick={onGenerate}>
            Generar
          </button>
          <button className="btn" type="button" disabled={working} onClick={onClose}>Volver al formulario</button>
        </div>
      </div>
    </section>
  );
}

function actionHint(plan: GenerationPlan, dirty: boolean, blocked: boolean) {
  if (plan.status === 'used') return 'Este plan ya se usó en una generación.';
  if (blocked) return 'Corrige los problemas marcados para guardar.';
  if (dirty) return 'Tienes cambios sin guardar. Guárdalos antes de aprobar.';
  if (plan.status === 'approved') return 'Plan aprobado. Ya puedes generar.';
  if (!plan.validation.valid) return 'Corrige los problemas del plan para aprobarlo. «Generar» se habilita con el plan aprobado.';
  return 'Aprueba el plan para habilitar «Generar».';
}

function outcomeText(unit: Unit, outcomeId: string | null) {
  if (!outcomeId) return '';
  const outcome = unit.outcomes.find(({ id }) => id === outcomeId);
  if (!outcome) return outcomeId;
  return outcome.code ? `${outcome.code}: ${outcome.text}` : outcome.text;
}

function FragmentQuote({ id, fragment }: { id: string; fragment?: PlanFragment }) {
  if (!fragment) {
    return <p className="field__hint">Fragmento {id}: no está en la evidencia del plan.</p>;
  }
  return (
    <figure className="generation-plan__fragment">
      <blockquote>{fragment.text}</blockquote>
      <figcaption className="field__hint">{fragment.documentName} · {fragment.location}</figcaption>
    </figure>
  );
}
