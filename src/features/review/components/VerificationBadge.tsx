import type { VerificationResult } from '../model/resource';
import { verificationView } from '../model/verificationView';
import '../review.css';

interface VerificationBadgeProps {
  verification: VerificationResult | null | undefined;
  onRetry: () => void;
  retrying?: boolean;
}

/** Estado de la verificación del recurso, su motivo y la acción disponible. La decisión está en `verificationView`. */
export function VerificationBadge({ verification, onRetry, retrying = false }: VerificationBadgeProps) {
  const view = verificationView(verification);
  const alert = view.tone === 'blocked' || view.tone === 'warning';
  return (
    <div className={'verification verification--' + view.tone} role={alert ? 'alert' : 'status'}>
      <p><strong>Respaldo: {view.label}</strong></p>
      {view.reason && <p>{view.reason}</p>}
      {view.hint && <p className="muted">{view.hint}</p>}
      {view.retryLabel && (
        <button type="button" className="btn" onClick={onRetry} disabled={retrying}>{view.retryLabel}</button>
      )}
    </div>
  );
}
