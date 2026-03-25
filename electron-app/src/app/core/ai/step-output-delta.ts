/**
 * Step Output Delta
 *
 * Extracts the expected output changes (new columns, renamed columns, new dataframes)
 * from a dialog plan step's state. Used by the intent resolver to thread state
 * across multi-step plans so step N can reference columns created by step N-1.
 */

export interface StepOutputDelta {
  createdColumns: string[];
  renamedColumns: Array<{ from: string; to: string }>;
  createdDataframes: string[];
}

const EMPTY_DELTA: StepOutputDelta = {
  createdColumns: [],
  renamedColumns: [],
  createdDataframes: [],
};

/**
 * Extract the expected output delta for a dialog step.
 * Returns what columns/dataframes the step is expected to create or rename.
 */
export function extractStepDelta(
  dialogId: string,
  state: Record<string, unknown>
): StepOutputDelta {
  switch (dialogId) {
    case 'calculate': {
      const newCol = str(state['newColumnName']);
      return newCol
        ? { ...EMPTY_DELTA, createdColumns: [newCol] }
        : EMPTY_DELTA;
    }

    case 'rename': {
      const oldName = str(state['oldName']);
      const newName = str(state['newName']);
      return oldName && newName
        ? { ...EMPTY_DELTA, renamedColumns: [{ from: oldName, to: newName }] }
        : EMPTY_DELTA;
    }

    case 'recode': {
      const newCol = str(state['newColumnName']);
      // If no new column name, recode overwrites the source column (no delta)
      return newCol
        ? { ...EMPTY_DELTA, createdColumns: [newCol] }
        : EMPTY_DELTA;
    }

    case 'stack':
    case 'unstack':
    case 'merge': {
      // These create new dataframes but the name is unpredictable from state alone
      // We can't thread this reliably - return empty
      return EMPTY_DELTA;
    }

    default:
      return EMPTY_DELTA;
  }
}

/**
 * Apply accumulated deltas to a data context, adding virtual columns/dataframes
 * so that subsequent step validation can find references to them.
 */
export function applyDeltasToContext(
  baseContext: { dataframes: string[]; columnsByDataframe: Record<string, Array<{ name: string; type: string }>> },
  deltas: StepOutputDelta[],
  targetDataframe?: string
): { dataframes: string[]; columnsByDataframe: Record<string, Array<{ name: string; type: string }>> } {
  const result = {
    dataframes: [...baseContext.dataframes],
    columnsByDataframe: Object.fromEntries(
      Object.entries(baseContext.columnsByDataframe).map(([k, v]) => [k, [...v]])
    ),
  };

  for (const delta of deltas) {
    const df = targetDataframe ?? result.dataframes[0];
    if (!df) continue;

    const columns = result.columnsByDataframe[df] ?? [];

    for (const col of delta.createdColumns) {
      if (!columns.some(c => c.name === col)) {
        columns.push({ name: col, type: 'numeric' }); // Default type assumption
      }
    }

    for (const { from, to } of delta.renamedColumns) {
      const idx = columns.findIndex(c => c.name === from);
      if (idx >= 0) {
        columns[idx] = { ...columns[idx], name: to };
      } else {
        columns.push({ name: to, type: 'character' });
      }
    }

    for (const newDf of delta.createdDataframes) {
      if (!result.dataframes.includes(newDf)) {
        result.dataframes.push(newDf);
        result.columnsByDataframe[newDf] = [];
      }
    }

    result.columnsByDataframe[df] = columns;
  }

  return result;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
