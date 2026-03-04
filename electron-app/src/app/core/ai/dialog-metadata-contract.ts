import { getSchema } from './dialog-catalog-aggregator';

export interface MetadataStateDiagnostics {
  unknownKeys: string[];
  unregisteredKeys: string[];
}

export function getMetadataStateDiagnostics(
  dialogId: string,
  state: Record<string, unknown>,
  registeredFieldNames: Iterable<string>
): MetadataStateDiagnostics {
  const schema = getSchema(dialogId);
  if (!schema) {
    return { unknownKeys: [], unregisteredKeys: [] };
  }

  const registered = new Set(registeredFieldNames);
  const schemaParamNames = new Set(schema.params.map((param) => param.name));
  const stateKeys = Object.keys(state ?? {});

  const unknownKeys = stateKeys.filter(
    (key) => key !== 'dataframe' && !schemaParamNames.has(key)
  );

  const unregisteredKeys = stateKeys.filter(
    (key) =>
      key !== 'dataframe' &&
      schemaParamNames.has(key) &&
      !registered.has(key)
  );

  return { unknownKeys, unregisteredKeys };
}
