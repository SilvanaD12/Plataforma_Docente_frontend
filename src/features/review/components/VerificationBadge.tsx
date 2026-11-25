import type { VerificationResult } from '../model/resource';
import { verificationView } from '../model/verificationView';
import '../review.css';

interface VerificationBadgeProps {
  verification: VerificationResult | null | undefined;
  onRetry?: () => void;
  /** Reintento no disponible ahora: hay una solicitud en curso o cambios sin guardar. */
  retryDisabled?: boolean;
  /** Por qué no se puede reintentar ahora (por ejemplo, cambios sin guardar). */
  retryHint?: string | null;
  /** Versión compacta en una línea (solo etiqueta) para la cabecera plegable, sin botones anidados. */
  compact?: boolean;
}

/** Estado de la verificación del recurso, su motivo y la acción disponible. La decisión está en `verificationView`. */
export function VerificationBadge({
  verification,
  onRetry,
  retryDisabled = false,
  retryHint = null,
  compact = false,
}: VerificationBadgeProps) {
  const view = verificationView(verification);
  if (compact) {
    return (
      <span className={'verification-pill verification-pill--' + view.tone}>
        Respaldo: {view.label}
      </span>
    );
  }
  const alert = view.tone === 'blocked' || view.tone === 'warning';
  return (
    <div className={'verification verification--' + view.tone} role={alert ? 'alert' : 'status'}>
      <p><strong>Respaldo: {view.label}</strong></p>
      {view.reason && <p>{view.reason}</p>}
      {view.hint && <p className="muted">{view.hint}</p>}
      {view.retryLabel && onRetry && (
        <button type="button" className="btn" onClick={onRetry} disabled={retryDisabled}>{view.retryLabel}</button>
      )}
      {view.retryLabel && retryHint && <p className="muted">{retryHint}</p>}
    </div>
  );
}
