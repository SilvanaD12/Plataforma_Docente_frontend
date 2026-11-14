import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../../../shared/api/httpClient';
import type { Unit } from '../../../shared/types/courses';
import { interpretGenerationRequest } from '../api/generationApi';
import type { ResourceTypesState } from '../hooks/useResourceTypes';
import { isSessionExpired } from '../model/generationErrors';
import {
  applyInterpretationDraft, changeModality, changeMode, generationSubmission, initialGenerationForm, selectedResourceTypes, toggleType,
  maxGenerationContextLength, type GenerationForm as GenerationFormValue,
} from '../model/generationForm';
import {
  maxQuantity, maxSequenceTypes, minQuantity, resourceModalities, stageLabel,
  type GenerationInterpretation, type GenerationMode, type StartGenerationRequest,
} from '../model/generationRequest';
import { previewFromRequest } from '../model/generationPreview';
import { hasModalityCatalog, typesByStage, typesForModality } from '../model/resourceTypes';
import { GenerationPreview } from './GenerationPreview';
import '../generation.css';

interface GenerationFormProps {
  unit: Unit;
  catalog: ResourceTypesState;
  token?: string;
  onSessionExpired?: (token: string) => void;
  submitting?: boolean;
  error?: string;
  onSubmit: (body: StartGenerationRequest) => void;
  initialValue?: GenerationFormValue;
}

const modes: { value: GenerationMode; label: string; hint: string }[] = [
  { value: 'individual', label: 'Recurso individual', hint: 'Un solo tipo de recurso.' },
  { value: 'sequence', label: 'Secuencia 5E', hint: `Hasta ${maxSequenceTypes} tipos, generados en orden de Enganchar a Evaluar.` },
];

const quantities = Array.from({ length: maxQuantity - minQuantity + 1 }, (_, index) => minQuantity + index);

export function GenerationForm({
  unit, catalog, token, onSessionExpired, submitting = false, error, onSubmit,
  initialValue = initialGenerationForm,
}: GenerationFormProps) {
  const [form, setForm] = useState(initialValue);
  const [problem, setProblem] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<GenerationInterpretation | null>(null);
  const [chatError, setChatError] = useState('');
  // Cuerpo armado al pulsar «Generar». Mientras existe, se muestra la vista previa y el formulario no se edita.
  const [pending, setPending] = useState<StartGenerationRequest | null>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const locked = submitting || interpreting || pending !== null;
  const sequence = form.mode === 'sequence';
  const supportsModalities = hasModalityCatalog(catalog.types);
  const visibleTypes = supportsModalities
    ? typesForModality(catalog.types, form.modality)
    : catalog.types;
  const selection = selectedResourceTypes(form, catalog.types);
  const needsType = supportsModalities && selection.length === 0;
  const cannotSubmit = locked || catalog.loading || catalog.types.length === 0 || needsType;
  const full = sequence && selection.length >= maxSequenceTypes;

  useEffect(() => {
    if (pending || !returnFocus.current) return;
    returnFocus.current = false;
    submitButton.current?.focus();
  }, [pending]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cannotSubmit) return;
    const { body, problem: found } = generationSubmission(form, unit.id, catalog.types);
    setProblem(found ?? '');
    if (!found) setPending(body);
  }

  function confirm() {
    // Se envía exactamente el cuerpo de la vista previa; la clave de idempotencia la decide useStartGeneration.
    if (pending && !submitting) onSubmit(pending);
  }

  function edit() {
    returnFocus.current = true;
    setPending(null);
  }

  function update(next: GenerationFormValue) {
    setForm(next);
    setProblem('');
  }

  async function interpret(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = chatMessage.trim();
    if (!token || !text || locked) return;

    setInterpreting(true);
    setChatError('');
    setInterpretation(null);
    try {
      const result = await interpretGenerationRequest(token, unit.id, text);
      setForm((current) => applyInterpretationDraft(current, result.draft));
      setProblem('');
      setInterpretation(result);
    } catch (error) {
      if (isSessionExpired(error) && onSessionExpired) onSessionExpired(token);
      else setChatError(errorMessage(error));
    } finally {
      setInterpreting(false);
    }
  }

  const message = problem || error;
  return (
    <>
      {token && (
        <form className="card" aria-labelledby="generation-chat-title" onSubmit={interpret}>
          <h2 className="h2" id="generation-chat-title">Chat de Generación</h2>
          <p>Unidad activa: {unit.title}</p>
          <label className="field">
            <span className="field__label">¿Qué recursos quieres generar?</span>
            <textarea
              className="input"
              value={chatMessage}
              maxLength={2000}
              disabled={locked}
              onChange={(event) => setChatMessage(event.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={locked || !chatMessage.trim()}>
            {interpreting ? 'Interpretando…' : 'Interpretar'}
          </button>
          {chatError && <p className="alert alert--warn" role="alert">{chatError}</p>}
          {interpretation && (
            <div role="status">
              {interpretation.suggestedUnit && (
                <p>Unidad sugerida: {interpretation.suggestedUnit.label}. Se mantiene la unidad activa.</p>
              )}
              {interpretation.stages.length > 0 && (
                <ul>
                  {interpretation.stages.map(({ resourceType, stage }) => (
                    <li key={resourceType}>
                      {catalog.types.find((type) => type.id === resourceType)?.name ?? resourceType}
                      {' · '}{stageLabel(stage)}
                    </li>
                  ))}
                </ul>
              )}
              {interpretation.issues.length > 0 && (
                <ul>
                  {interpretation.issues.map((issue, index) => (
                    <li key={`${issue.field}-${index}`}>
                      {issue.message}
                      {issue.options.length > 0 && ` Opciones: ${issue.options.map(({ label }) => label).join(', ')}.`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      )}
      <form className="card" aria-labelledby="generation-form-title" onSubmit={submit} noValidate>
        <h2 className="h2" id="generation-form-title">Nueva generación</h2>
        <fieldset className="generation-fieldset" disabled={locked}>
          <legend className="field__label">Modo</legend>
          <div className="generation-choices generation-choices--modes">
            {modes.map(({ value, label, hint }) => (
              <label className="generation-choice" key={value}>
                <input type="radio" name="mode" value={value} checked={form.mode === value}
                  onChange={() => update(changeMode(form, value))} />
                <span><span className="title">{label}</span><span className="field__hint generation-choice__hint">{hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        {supportsModalities && (
          <label className="field">
            <span className="field__label">Modalidad</span>
            <select className="input" name="modality" value={form.modality} disabled={locked || catalog.loading}
              onChange={(event) => {
                const modality = resourceModalities.find((value) => value === event.target.value);
                if (modality) update(changeModality(form, modality, catalog.types));
              }}>
              {resourceModalities.map((modality) => <option key={modality} value={modality}>{modality}</option>)}
            </select>
          </label>
        )}

        <fieldset className="generation-fieldset" disabled={locked} aria-describedby="generation-types-hint">
          <legend className="field__label">{sequence ? 'Tipos de recurso' : 'Tipo de recurso'}</legend>
          <span className="field__hint" id="generation-types-hint">
            {sequence
              ? `Elegidos: ${selection.length} de ${maxSequenceTypes}. Se generan en orden 5E.`
              : 'Elige un tipo de recurso.'}
          </span>
          {catalog.loading && <p className="muted" role="status">Cargando los tipos de recurso…</p>}
          {catalog.error && (
            <div className="alert alert--warn" role="alert">
              <span>{catalog.error}</span>
              <button className="btn" type="button" onClick={catalog.reload}>Reintentar</button>
            </div>
          )}
          {typesByStage(visibleTypes).map(({ stage, types }) => (
            <div className="stack generation-stage" key={stage}>
              <p className="overline">{stageLabel(stage)}</p>
              <div className="generation-choices">
                {types.map((type) => {
                  const checked = selection.includes(type.id);
                  return (
                    <label className="generation-choice" key={type.id}>
                      <input
                        type={sequence ? 'checkbox' : 'radio'}
                        name="resourceTypes"
                        value={type.id}
                        checked={checked}
                        disabled={full && !checked}
                        onChange={() => update(toggleType(form, type.id))}
                      />
                      <span>{type.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>

        <div className="generation-options">
          <label className="field">
            <span className="field__label">Cantidad por tipo</span>
            <select className="input" name="quantity" value={form.quantity} disabled={locked}
              onChange={(event) => update({ ...form, quantity: Number(event.target.value) })}>
              {quantities.map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
            </select>
            <span className="field__hint">La misma cantidad para cada tipo elegido.</span>
          </label>
        </div>

        <fieldset className="generation-fieldset" disabled={locked}>
          <legend className="field__label">Contexto</legend>
          <label className="field">
            <span className="field__label">Resultado de aprendizaje (opcional)</span>
            <select className="input" name="outcomeId" value={form.outcomeId} disabled={locked || unit.outcomes.length === 0}
              onChange={(event) => update({ ...form, outcomeId: event.target.value })}>
              <option value="">{unit.outcomes.length ? 'Toda la unidad' : 'La unidad no tiene resultados registrados'}</option>
              {unit.outcomes.map((outcome) => (
                <option key={outcome.id} value={outcome.id}>{outcome.code ? `${outcome.code}: ${outcome.text}` : outcome.text}</option>
              ))}
            </select>
          </label>
          <div className="generation-context">
            <label className="field">
              <span className="field__label">Audiencia (opcional)</span>
              <input className="input" type="text" name="audience" value={form.audience}
                maxLength={maxGenerationContextLength} disabled={locked}
                onChange={(event) => update({ ...form, audience: event.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Competencia (opcional)</span>
              <input className="input" type="text" name="competency" value={form.competency}
                maxLength={maxGenerationContextLength} disabled={locked}
                onChange={(event) => update({ ...form, competency: event.target.value })} />
            </label>
          </div>
          <label className="field">
            <span className="field__label">Instrucciones (opcional)</span>
            <textarea
              className="input"
              name="instructions"
              value={form.instructions}
              maxLength={500}
              disabled={locked}
              onChange={(event) => update({ ...form, instructions: event.target.value })}
            />
          </label>
        </fieldset>

        {message && <p className="alert alert--warn" role="alert">{message}</p>}
        <div>
          {needsType && (
            <p className="field__hint" id="generation-modality-hint" role="status">
              {visibleTypes.length ? 'Elige un tipo de recurso compatible con esta modalidad para generar.' : 'Esta modalidad todavía no tiene tipos disponibles.'}
            </p>
          )}
          <button ref={submitButton} className="btn btn--primary" type="submit" aria-busy={submitting && !pending}
            aria-describedby={needsType ? 'generation-modality-hint' : undefined} disabled={cannotSubmit}>
            {submitting && !pending ? 'Enviando…' : sequence ? 'Generar secuencia' : 'Generar recurso'}
          </button>
        </div>
      </form>
      {pending && (
        <GenerationPreview preview={previewFromRequest(pending, unit, catalog.types)} submitting={submitting}
          onConfirm={confirm} onEdit={edit} />
      )}
    </>
  );
}
