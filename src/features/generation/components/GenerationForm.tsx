import { useState, type FormEvent } from 'react';
import type { Unit } from '../../../shared/types/courses';
import type { ResourceTypesState } from '../hooks/useResourceTypes';
import {
  changeMode, generationFormProblem, generationRequestBody, initialGenerationForm, toggleType,
  maxGenerationContextLength, type GenerationForm as GenerationFormValue,
} from '../model/generationForm';
import {
  maxQuantity, maxSequenceTypes, minQuantity, stageLabel,
  type GenerationMode, type StartGenerationRequest,
} from '../model/generationRequest';
import { typesByStage } from '../model/resourceTypes';
import '../generation.css';

interface GenerationFormProps {
  unit: Unit;
  catalog: ResourceTypesState;
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

export function GenerationForm({ unit, catalog, submitting = false, error, onSubmit, initialValue = initialGenerationForm }: GenerationFormProps) {
  const [form, setForm] = useState(initialValue);
  const [problem, setProblem] = useState('');
  const sequence = form.mode === 'sequence';
  const full = sequence && form.resourceTypes.length >= maxSequenceTypes;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const body = generationRequestBody(form, unit.id, catalog.types);
    const found = generationFormProblem(body);
    setProblem(found ?? '');
    if (!found) onSubmit(body);
  }

  function update(next: GenerationFormValue) {
    setForm(next);
    setProblem('');
  }

  const message = problem || error;
  return (
    <form className="card" aria-labelledby="generation-form-title" onSubmit={submit} noValidate>
      <h2 className="h2" id="generation-form-title">Nueva generación</h2>
      <fieldset className="generation-fieldset" disabled={submitting}>
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

      <fieldset className="generation-fieldset" disabled={submitting} aria-describedby="generation-types-hint">
        <legend className="field__label">{sequence ? 'Tipos de recurso' : 'Tipo de recurso'}</legend>
        <span className="field__hint" id="generation-types-hint">
          {sequence
            ? `Elegidos: ${form.resourceTypes.length} de ${maxSequenceTypes}. Se generan en orden 5E.`
            : 'Elige un tipo de recurso.'}
        </span>
        {catalog.loading && <p className="muted" role="status">Cargando los tipos de recurso…</p>}
        {catalog.error && (
          <div className="alert alert--warn" role="alert">
            <span>{catalog.error}</span>
            <button className="btn" type="button" onClick={catalog.reload}>Reintentar</button>
          </div>
        )}
        {typesByStage(catalog.types).map(({ stage, types }) => (
          <div className="stack generation-stage" key={stage}>
            <p className="overline">{stageLabel(stage)}</p>
            <div className="generation-choices">
              {types.map((type) => {
                const checked = form.resourceTypes.includes(type.id);
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
          <select className="input" name="quantity" value={form.quantity} disabled={submitting}
            onChange={(event) => update({ ...form, quantity: Number(event.target.value) })}>
            {quantities.map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
          </select>
          <span className="field__hint">La misma cantidad para cada tipo elegido.</span>
        </label>
        <label className="field">
          <span className="field__label">Resultado de aprendizaje (opcional)</span>
          <select className="input" name="outcomeId" value={form.outcomeId} disabled={submitting || unit.outcomes.length === 0}
            onChange={(event) => update({ ...form, outcomeId: event.target.value })}>
            <option value="">{unit.outcomes.length ? 'Toda la unidad' : 'La unidad no tiene resultados registrados'}</option>
            {unit.outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>{outcome.code ? `${outcome.code}: ${outcome.text}` : outcome.text}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="generation-context">
        <label className="field">
          <span className="field__label">Audiencia (opcional)</span>
          <input className="input" type="text" name="audience" value={form.audience}
            maxLength={maxGenerationContextLength} disabled={submitting}
            onChange={(event) => update({ ...form, audience: event.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Competencia (opcional)</span>
          <input className="input" type="text" name="competency" value={form.competency}
            maxLength={maxGenerationContextLength} disabled={submitting}
            onChange={(event) => update({ ...form, competency: event.target.value })} />
        </label>
      </div>

      {message && <p className="alert alert--warn" role="alert">{message}</p>}
      <div>
        <button className="btn btn--primary" type="submit" aria-busy={submitting}
          disabled={submitting || catalog.loading || catalog.types.length === 0}>
          {submitting ? 'Enviando…' : sequence ? 'Generar secuencia' : 'Generar recurso'}
        </button>
      </div>
    </form>
  );
}
