import type { GenerationError } from '../model/generationErrors';

interface PlanErrorDetailsProps {
  error: GenerationError;
  busy?: boolean;
  /** `PLAN_VERSION_CONFLICT`: traer la versión actual del plan. */
  onReload?: () => void;
  /** `PLAN_EVIDENCE_STALE` o `PLAN_ALREADY_USED`: crear un plan nuevo con los mismos datos. */
  onReplan?: () => void;
  /** `PLAN_REQUIRED`: crear el plan con los datos del pedido rechazado. */
  onPlan?: () => void;
  /** `PLAN_NOT_FOUND`: dejar el plan y volver al formulario. */
  onClose?: () => void;
}

const fragmentCount = (count: number) => (count === 1 ? '1 fragmento' : `${count} fragmentos`);

/** Explicación y acción para cada error del plan. El `message` del servidor lo muestra quien lo usa. */
export function PlanErrorDetails({ error, busy = false, onReload, onReplan, onPlan, onClose }: PlanErrorDetailsProps) {
  switch (error.kind) {
    case 'planVersionConflict':
      return (
        <>
          <p>Este plan cambió en otra pestaña o sesión. Recarga la versión actual; los cambios sin guardar se pierden.</p>
          {onReload && <div><button className="btn" type="button" disabled={busy} onClick={onReload}>Recargar el plan</button></div>}
        </>
      );
    case 'planInvalid':
      return <p>Corrige los problemas marcados junto a cada ítem y vuelve a aprobar.</p>;
    case 'planEvidenceStale':
      return (
        <>
          <p>El material de la unidad cambió después de armar el plan y algunos fragmentos ya no existen:</p>
          {error.staleDocuments && error.staleDocuments.length > 0 && (
            <ul className="generation-list" aria-label="Documentos que cambiaron">
              {error.staleDocuments.map((document) => (
                <li key={document.documentId}>
                  {document.documentName} (faltan {fragmentCount(document.missingFragmentIds.length)})
                </li>
              ))}
            </ul>
          )}
          <p>No se creó ningún pedido. Arma un plan nuevo con los mismos datos.</p>
          {onReplan && <div><button className="btn" type="button" disabled={busy} onClick={onReplan}>Planificar de nuevo</button></div>}
        </>
      );
    case 'planAlreadyUsed':
      return (
        <>
          <p>Este plan ya se usó en una generación. Para generar otra vez, arma un plan nuevo.</p>
          {onReplan && <div><button className="btn" type="button" disabled={busy} onClick={onReplan}>Planificar de nuevo</button></div>}
        </>
      );
    case 'planNotApproved':
      return <p>Aprueba el plan antes de generar.</p>;
    case 'planNotFound':
      return (
        <>
          <p>El plan ya no está disponible.</p>
          {onClose && <div><button className="btn" type="button" disabled={busy} onClick={onClose}>Volver al formulario</button></div>}
        </>
      );
    case 'planRequired':
      return (
        <>
          <p>Antes de generar hay que preparar un plan y aprobarlo. Usa «Planificar» con los mismos datos.</p>
          {onPlan && <div><button className="btn" type="button" disabled={busy} onClick={onPlan}>Planificar con estos datos</button></div>}
        </>
      );
    default:
      return null;
  }
}
