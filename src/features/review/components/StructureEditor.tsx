import type { StructureField, StructureSchema } from '../model/structureRules';

interface StructureEditorProps {
  idPrefix: string;
  schema: StructureSchema;
  structure: Record<string, unknown>;
  disabled: boolean;
  onField: (key: string, value: string | boolean) => void;
  onItem: (listKey: string, index: number, field: string | null, value: string | boolean) => void;
  onAdd: (listKey: string) => void;
  onRemove: (listKey: string, index: number) => void;
}

interface InputProps {
  id: string;
  field: StructureField;
  value: unknown;
  disabled: boolean;
  onChange: (value: string | boolean) => void;
}

function FieldInput({ id, field, value, disabled, onChange }: InputProps) {
  if (field.kind === 'boolean') {
    return (
      <select id={id} className="input" value={value === true ? 'true' : 'false'} disabled={disabled}
        onChange={(event) => onChange(event.target.value === 'true')}>
        <option value="true">Verdadero</option>
        <option value="false">Falso</option>
      </select>
    );
  }
  const text = typeof value === 'string' ? value : '';
  return field.kind === 'longText'
    ? <textarea id={id} className="input" rows={3} value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    : <input id={id} className="input" value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
}

/** Editor genérico de la `structure`: lo que se muestra de cada tipo sale de `model/structureRules`. */
export function StructureEditor({ idPrefix, schema, structure, disabled, onField, onItem, onAdd, onRemove }: StructureEditorProps) {
  const list = schema.list;
  const items = list && Array.isArray(structure[list.key]) ? (structure[list.key] as unknown[]) : [];
  return (
    <div className="stack review-structure">
      {schema.fields.map((field) => (
        <div key={field.key} className="field">
          <label htmlFor={`${idPrefix}-${field.key}`}>{field.label}</label>
          <FieldInput id={`${idPrefix}-${field.key}`} field={field} value={structure[field.key]} disabled={disabled}
            onChange={(value) => onField(field.key, value)} />
        </div>
      ))}

      {list && (
        <fieldset className="stack review-structure__list">
          <legend>{list.label}</legend>
          {items.map((item, index) => (
            <div key={index} className="review-option">
              {list.fields.length === 0 ? (
                <div className="field">
                  <label htmlFor={`${idPrefix}-${list.key}-${index}`}>{`${index + 1}.`}</label>
                  <input id={`${idPrefix}-${list.key}-${index}`} className="input" value={typeof item === 'string' ? item : ''}
                    disabled={disabled} onChange={(event) => onItem(list.key, index, null, event.target.value)} />
                </div>
              ) : list.fields.map((field) => (
                <div key={field.key} className="field">
                  <label htmlFor={`${idPrefix}-${list.key}-${index}-${field.key}`}>{field.label}</label>
                  <FieldInput id={`${idPrefix}-${list.key}-${index}-${field.key}`} field={field}
                    value={(item as Record<string, unknown> | null)?.[field.key]} disabled={disabled}
                    onChange={(value) => onItem(list.key, index, field.key, value)} />
                </div>
              ))}
              <button type="button" className="btn" disabled={disabled} onClick={() => onRemove(list.key, index)}>
                {`Quitar ${list.itemLabel} ${index + 1}`}
              </button>
            </div>
          ))}
          <button type="button" className="btn" disabled={disabled} onClick={() => onAdd(list.key)}>
            {`Agregar ${list.itemLabel}`}
          </button>
        </fieldset>
      )}
    </div>
  );
}
