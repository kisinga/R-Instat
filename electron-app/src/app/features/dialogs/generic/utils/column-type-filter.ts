/**
 * Column Type Filter
 *
 * Maps DialogParamSchema.columnType hints to the filterTypes array
 * expected by ColumnPickerComponent.
 */

import type { ColumnTypeHint } from '../../../../core/ai/dialog-schema.registry';
import type { ColumnInfo } from '../../../../core/models/r.model';

const FILTER_MAP: Record<string, string[]> = {
  numeric: ['numeric', 'integer', 'double'],
  factor: ['factor', 'character'],
  date: ['date', 'posix'],
};

/** Returns the filterTypes array for ColumnPicker based on a ColumnTypeHint. */
export function columnTypeToFilterTypes(hint: ColumnTypeHint | undefined): string[] {
  if (!hint || hint === 'any') return [];
  return FILTER_MAP[hint] ?? [];
}

/** Filters a ColumnInfo array by a ColumnTypeHint. */
export function filterColumnsByType(
  columns: ColumnInfo[],
  hint: ColumnTypeHint | undefined
): ColumnInfo[] {
  const types = columnTypeToFilterTypes(hint);
  if (types.length === 0) return columns;
  return columns.filter((col) => {
    const colType = col.type.toLowerCase();
    return types.some((t) => colType.includes(t.toLowerCase()));
  });
}
