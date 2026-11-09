import { canEdit, type EditorState } from './reviewEditor';
import { emptyItem, structureSchema } from './structureRules';

export { structureProblem, structureSchema } from './structureRules';

type Structure = Record<string, unknown>;

/** Aplica un cambio a la estructura del borrador. No hace nada con una solicitud en curso. */
function withStructure(state: EditorState, change: (structure: Structure) => Structure): EditorState {
  if (!canEdit(state)) return state;
  const structure = change({ ...((state.draft.structure ?? {}) as Structure) });
  return { ...state, draft: { ...state.draft, structure, edited: true } };
}

function listOf(structure: Structure, key: string): unknown[] {
  return Array.isArray(structure[key]) ? [...(structure[key] as unknown[])] : [];
}

export function setStructureField(state: EditorState, key: string, value: string | boolean): EditorState {
  return withStructure(state, (structure) => ({ ...structure, [key]: value }));
}

/**
 * Cambia un campo de un elemento de la lista (o el elemento entero si es un texto, con `field = null`). Lo que el
 * docente no edita, como los fragmentos que respaldan un paso (`fragmentIds`), se conserva.
 */
export function setStructureItem(
  state: EditorState,
  listKey: string,
  index: number,
  field: string | null,
  value: string | boolean,
): EditorState {
  return withStructure(state, (structure) => {
    const items = listOf(structure, listKey);
    items[index] = field === null ? value : { ...(items[index] as Structure), [field]: value };
    return { ...structure, [listKey]: items };
  });
}

export function addStructureItem(state: EditorState, listKey: string): EditorState {
  const list = structureSchema(state.draft.type)?.list;
  if (!list || list.key !== listKey) return state;
  return withStructure(state, (structure) => ({ ...structure, [listKey]: [...listOf(structure, listKey), emptyItem(list)] }));
}

export function removeStructureItem(state: EditorState, listKey: string, index: number): EditorState {
  return withStructure(state, (structure) => ({
    ...structure,
    [listKey]: listOf(structure, listKey).filter((_, position) => position !== index),
  }));
}
