import type { ResolverTransform } from '../../services/intent-resolver.pipeline';
import type { DialogParamSchema } from '../dialog-schema.registry';
import type { DataContext } from '../types/data-context.types';
import { mapColumnType } from '../shared/column-type-mapper';

export function createInferMissingFieldsTransform(): ResolverTransform {
  return {
    id: 'infer-missing-fields',
    scope: 'global',
    run: (dialogId, params, state, dataContext, warnings) =>
      inferMissingFields(dialogId, params, state, dataContext, warnings),
  };
}

function inferMissingFields(
  dialogId: string,
  params: DialogParamSchema[],
  state: Record<string, unknown>,
  dataContext: DataContext,
  warnings: string[]
): Record<string, unknown> {
  const normalized = { ...state };

  const dataframeParam = params.find((p) => p.name === 'dataframe');
  if (dataframeParam?.required && !normalized['dataframe']) {
    const fallbackDf = dataContext.activeDataframe ?? dataContext.dataframes[0];
    if (fallbackDf) {
      normalized['dataframe'] = fallbackDf;
      warnings.push(`Auto-selected dataframe "${fallbackDf}" for ${dialogId}`);
    }
  }

  const dfName = (normalized['dataframe'] as string) || dataContext.activeDataframe;
  const columns = dfName ? dataContext.columnsByDataframe[dfName] ?? [] : [];
  if (columns.length === 0) return normalized;

  for (const param of params) {
    const active = isConditionActive(param, normalized);
    if (!active || !param.required) continue;
    const current = normalized[param.name];
    if (current !== undefined && current !== null && current !== '') continue;

    if (param.kind === 'column') {
      const inferred = pickColumnForParam(param, columns, normalized);
      if (inferred) {
        normalized[param.name] = inferred;
        warnings.push(`Inferred "${param.name}" as "${inferred}" for ${dialogId}`);
      }
    } else if (param.kind === 'column[]') {
      const inferredMany = pickColumnsForParam(param, columns, normalized);
      if (inferredMany.length > 0) {
        normalized[param.name] = inferredMany;
        warnings.push(`Inferred "${param.name}" as [${inferredMany.join(', ')}] for ${dialogId}`);
      }
    } else if (param.kind === 'enum' && Array.isArray(param.enumValues) && param.enumValues.length > 0) {
      normalized[param.name] = param.enumValues[0];
      warnings.push(`Defaulted enum "${param.name}" to "${param.enumValues[0]}" for ${dialogId}`);
    }
  }

  return normalized;
}

function isConditionActive(param: DialogParamSchema, state: Record<string, unknown>): boolean {
  if (!param.when) return true;
  return state[param.when.param] === param.when.equals;
}

function pickColumnForParam(
  param: DialogParamSchema,
  columns: Array<{ name: string; type: string }>,
  state: Record<string, unknown>
): string | null {
  const requiredType = param.columnType ?? 'any';
  const used = getUsedColumnNames(state);
  const candidates = columns.filter((col) => {
    const mapped = mapColumnType(col.type);
    return (requiredType === 'any' || mapped === requiredType) && !used.has(col.name);
  });
  if (candidates.length === 0) return null;

  const scored = candidates
    .map((col) => ({ col, score: scoreColumnForParamName(col.name, param.name) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.col.name ?? candidates[0].name;
}

function pickColumnsForParam(
  param: DialogParamSchema,
  columns: Array<{ name: string; type: string }>,
  state: Record<string, unknown>
): string[] {
  const requiredType = param.columnType ?? 'any';
  const used = getUsedColumnNames(state);
  const candidates = columns.filter((col) => {
    const mapped = mapColumnType(col.type);
    return (requiredType === 'any' || mapped === requiredType) && !used.has(col.name);
  });
  if (candidates.length === 0) return [];

  const sorted = candidates
    .map((col) => ({ col, score: scoreColumnForParamName(col.name, param.name) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.col.name);

  return sorted.slice(0, Math.min(2, sorted.length));
}

function getUsedColumnNames(state: Record<string, unknown>): Set<string> {
  const used = new Set<string>();
  for (const value of Object.values(state)) {
    if (typeof value === 'string') {
      used.add(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') used.add(item);
      }
    }
  }
  return used;
}

function scoreColumnForParamName(columnName: string, paramName: string): number {
  const c = columnName.toLowerCase();
  const p = paramName.toLowerCase();

  let score = 0;
  if (c === p) score += 100;
  if (c.includes(p) || p.includes(c)) score += 40;

  const semanticBuckets: Array<{ keys: string[]; weight: number }> = [
    { keys: ['date', 'time', 'year', 'month', 'day'], weight: 30 },
    { keys: ['group', 'category', 'type', 'class', 'species'], weight: 24 },
    { keys: ['x', 'horizontal'], weight: 18 },
    { keys: ['y', 'value', 'measure', 'amount', 'height', 'weight', 'score'], weight: 20 },
    { keys: ['station', 'site', 'region', 'country'], weight: 20 },
    { keys: ['rain', 'temp', 'tmax', 'tmin'], weight: 18 },
  ];

  for (const bucket of semanticBuckets) {
    const matchesParam = bucket.keys.some((k) => p.includes(k));
    const matchesColumn = bucket.keys.some((k) => c.includes(k));
    if (matchesParam && matchesColumn) {
      score += bucket.weight;
    }
  }

  return score;
}
