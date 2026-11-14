import { useEffect, useRef } from 'react';
import type { GenerationPreview as GenerationPreviewValue } from '../model/generationPreview';
import '../generation.css';

interface GenerationPreviewProps {
  preview: GenerationPreviewValue;
  submitting?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

const resourceCount = (count: number) => (count === 1 ? '1 recurso' : `${count} recursos`);

/** Resumen del pedido antes de confirmarlo (HU-040). No depende del formulario: recibe la vista previa ya armada. */
export function GenerationPreview({ preview, submitting = false, onConfirm, onEdit }: GenerationPreviewProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const context: [string, string | null][] = [
    ['Resultado de aprendizaje', preview.outcome],
    ['Audiencia', preview.audience],
    ['Competencia', preview.competency],
    ['Instrucciones', preview.instructions],
  ];

  return (
    <section className="card" aria-labelledby="generation-preview-title" aria-describedby="generation-preview-hint">
      <h2 className="h2" id="generation-preview-title" ref={heading} tabIndex={-1}>Revisa el pedido antes de generar</h2>
      <p className="muted" id="generation-preview-hint">
        Los pasos se generan en este orden 5E. Para cambiar algo, vuelve a editar el formulario.
      </p>

      <dl className="generation-preview__facts">
        <div><dt>Unidad</dt><dd>Unidad {preview.unitNumber}: {preview.unitTitle}</dd></div>
        <div><dt>Modo</dt><dd>{preview.modeLabel}</dd></div>
        <div><dt>Modalidad</dt><dd>{preview.modality}</dd></div>
        {context.filter(([, value]) => value).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>

      <div className="generation-preview__table-wrap">
        <table className="generation-preview__table">
          <caption className="field__label">Pasos en orden 5E</caption>
          <thead>
            <tr>
              <th scope="col">Paso</th>
              <th scope="col">Etapa</th>
              <th scope="col">Tipo de recurso</th>
              <th scope="col">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {preview.steps.map((step) => (
              <tr key={step.resourceType}>
                <td>{step.position}</td>
                <td>{step.stageLabel}</td>
                <th scope="row">{step.typeName}</th>
                <td>{step.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="title">Total: {resourceCount(preview.totalResources)}</p>

      <div className="course-actions">
        <button className="btn btn--primary" type="button" aria-busy={submitting} disabled={submitting} onClick={onConfirm}>
          {submitting ? 'Enviando…' : 'Confirmar y generar'}
        </button>
        <button className="btn" type="button" disabled={submitting} onClick={onEdit}>Volver a editar</button>
      </div>
    </section>
  );
}
