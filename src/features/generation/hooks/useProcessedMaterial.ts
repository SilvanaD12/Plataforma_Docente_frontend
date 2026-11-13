import { useEffect, useState } from 'react';
import { materialsApi } from '../../materials/api/materialsApi';
import { isSessionExpired } from '../model/generationErrors';

export async function hasProcessedMaterial(token: string, unitId: string): Promise<boolean> {
  const documents = await materialsApi.listDocuments(token);
  return documents.some((document) => document.unitId === unitId && document.status === 'procesado');
}

export function useProcessedMaterial(token: string, unitId: string, onSessionExpired: (token: string) => void) {
  const [available, setAvailable] = useState<boolean>();

  useEffect(() => {
    let active = true;
    setAvailable(undefined);

    void hasProcessedMaterial(token, unitId)
      .then((hasMaterial) => {
        if (active) setAvailable(hasMaterial);
      })
      .catch((error: unknown) => {
        if (active && isSessionExpired(error)) onSessionExpired(token);
        // Un fallo de consulta deja el estado sin confirmar. El servidor valida al enviar.
      });

    return () => { active = false; };
  }, [token, unitId, onSessionExpired]);

  return available;
}
