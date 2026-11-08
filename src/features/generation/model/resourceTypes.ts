import { stages, type Stage } from './generationRequest';

/** Elemento de `GET /api/v1/resource-types` (ResourceTypeResponse en docs/api/openapi.json). */
export interface ResourceTypeInfo {
  id: string;
  name: string;
  singular: string;
  count: [string, string];
  stage: Stage;
  group: string;
  format: 'text' | 'visual' | 'image' | 'audio' | 'interactive';
  hasOptions: boolean;
}

export function typesByStage(types: ResourceTypeInfo[]) {
  return stages
    .map((stage) => ({ stage, types: types.filter((type) => type.stage === stage) }))
    .filter(({ types }) => types.length > 0);
}

export function typeName(types: ResourceTypeInfo[], id: string) {
  return types.find((type) => type.id === id)?.name ?? id;
}
