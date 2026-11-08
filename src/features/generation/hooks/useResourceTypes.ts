import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../../shared/api/httpClient';
import { listResourceTypes } from '../api/resourceTypesApi';
import type { ResourceTypeInfo } from '../model/resourceTypes';

export interface ResourceTypesState {
  types: ResourceTypeInfo[];
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useResourceTypes(): ResourceTypesState {
  const [types, setTypes] = useState<ResourceTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listResourceTypes()
      .then((loaded) => { if (active) setTypes(loaded); })
      .catch((cause) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  return { types, loading, error, reload };
}
