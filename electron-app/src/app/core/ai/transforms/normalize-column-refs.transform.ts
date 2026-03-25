import type { ResolverTransform } from '../../services/intent-resolver.pipeline';
import type { DialogParamSchema } from '../dialog-schema.registry';
import type { DataContext } from '../types/data-context.types';
import { mapColumnType } from '../shared/column-type-mapper';

export function createNormalizeColumnRefsTransform(): ResolverTransform {
  return {
    id: 'normalize-column-references',
    scope: 'global',
    run: (dialogId, params, state, dataContext, warnings) =>
      normalizeColumnReferences(dialogId, params, state, dataContext, warnings),
  };
}

function normalizeColumnReferences(
  dialogId: string,
  params: DialogParamSchema[],
  state: Record<string, unknown>,
  dataContext: DataContext,
  warnings: string[]
): Record<string, unknown> {
  const normalized = { ...state };
  const dfName = (state['dataframe'] as string) || dataContext.activeDataframe;
  if (!dfName) return normalized;

  const columns = dataContext.columnsByDataframe[dfName] ?? [];
  if (columns.length === 0) return normalized;
  const columnNames = columns.map((c) => c.name);

  const processed = new Set<string>();
  for (const param of params) {
    if (processed.has(param.name)) continue;
    processed.add(param.name);

    if (param.kind !== 'column' && param.kind !== 'column[]') continue;
    const value = normalized[param.name];
    if (value === undefined || value === null || value === '') continue;

    if (param.kind === 'column' && typeof value === 'string') {
      const resolved = resolveColumnName(value, columnNames);
      if (resolved && resolved !== value) {
        normalized[param.name] = resolved;
        warnings.push(`Adjusted column "${value}" to "${resolved}" for ${dialogId}`);
      }

      if (dialogId === 'summary' && param.name === 'groupByColumn') {
        const currentName = normalized[param.name];
        if (typeof currentName === 'string' && currentName) {
          const currentCol = columns.find((c) => c.name === currentName);
          const currentType = currentCol ? mapColumnType(currentCol.type) : 'any';
          if (currentType !== 'factor') {
            const fallback = findFallbackGroupColumn(columns, currentName);
            if (fallback) {
              normalized[param.name] = fallback;
              warnings.push(
                `Adjusted summary groupByColumn from "${currentName}" to categorical column "${fallback}"`
              );
            } else {
              delete normalized[param.name];
              warnings.push(
                `Removed summary groupByColumn "${currentName}" because it is not categorical`
              );
            }
          }
        }
      }
    }

    if (param.kind === 'column[]' && Array.isArray(value)) {
      const updated = value.map((item) => {
        if (typeof item !== 'string') return item;
        const resolved = resolveColumnName(item, columnNames);
        if (resolved && resolved !== item) {
          warnings.push(`Adjusted column "${item}" to "${resolved}" for ${dialogId}`);
          return resolved;
        }
        return item;
      });
      normalized[param.name] = updated;
    }
  }
  return normalized;
}

function resolveColumnName(candidate: string, availableColumns: string[]): string | null {
  if (availableColumns.includes(candidate)) {
    return candidate;
  }

  const lower = candidate.toLowerCase();
  const caseInsensitive = availableColumns.filter((c) => c.toLowerCase() === lower);
  if (caseInsensitive.length === 1) {
    return caseInsensitive[0];
  }

  const normCandidate = normalizeColumnToken(candidate);
  const normalizedMatches = availableColumns.filter(
    (c) => normalizeColumnToken(c) === normCandidate
  );
  if (normalizedMatches.length === 1) {
    return normalizedMatches[0];
  }

  const tokenMatch = availableColumns.filter((c) => {
    const norm = normalizeColumnToken(c);
    return norm.includes(normCandidate) || normCandidate.includes(norm);
  });
  if (tokenMatch.length === 1) {
    return tokenMatch[0];
  }

  return null;
}

function normalizeColumnToken(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findFallbackGroupColumn(
  columns: Array<{ name: string; type: string }>,
  originalName: string
): string | null {
  const factorColumns = columns.filter((c) => mapColumnType(c.type) === 'factor');
  if (factorColumns.length === 0) return null;

  const preferred = factorColumns.find((c) =>
    /(user|name|group|owner|contributor|entity|region|country|sector|type|category|id)/i.test(c.name)
  );
  if (preferred) return preferred.name;

  const alternate = factorColumns.find((c) => c.name !== originalName);
  return (alternate ?? factorColumns[0]).name;
}
