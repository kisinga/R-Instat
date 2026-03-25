/**
 * Step-to-R adapter
 *
 * Maps AI plan step state (schema-shaped) to existing dialog R builders and returns
 * the generated script. Single source of truth for template-based R codegen.
 */

import { TEMPLATE_CODEGEN_DIALOG_IDS } from './dialog-registry-view';
import { getDialogSpec } from './generic-dialog/operation-spec.registry';
import { buildSort } from '../dialogs/builders/data-manipulation';
import type { SortColumn } from '../dialogs/builders/data-manipulation';
import { buildRename, buildCalculate, buildRecode } from '../dialogs/builders/data-manipulation';
import { buildDuplicateColumn, buildPermuteColumn, buildDeleteColumns, buildInsertColumn } from '../dialogs/builders/data-manipulation';
import type { RecodeMapping } from '../dialogs/builders/data-manipulation';
import { buildRegression, buildCorrelation, buildTTest } from '../dialogs/builders/statistics';
import { buildHistogram, buildBoxplot, buildScatter } from '../dialogs/builders/graphs';
import { buildBarChart } from '../dialogs/builders/barchart';

function str(s: unknown): string {
  return s !== undefined && s !== null ? String(s) : '';
}

function isPlaceholder(script: string): boolean {
  const t = script.trim();
  if (!t) return true;
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length === 1 && lines[0].startsWith('#');
}

/**
 * Compile a single dialog step (dialogId + state) to R script using existing builders.
 * Returns null if dialogId is not in template codegen set, state is incomplete, or builder would produce a placeholder.
 */
export function compileStepToR(dialogId: string, state: Record<string, unknown>): string | null {
  if (!TEMPLATE_CODEGEN_DIALOG_IDS.has(dialogId)) {
    // Not a built-in template dialog — try the spec's build() (covers imported dialogs)
    const spec = getDialogSpec(dialogId);
    if (spec?.build) {
      try {
        const result = spec.build(state);
        if (result && !isPlaceholder(result)) return result;
      } catch { /* fall through */ }
    }
    return null;
  }

  const df = str(state['dataframe']).trim();
  if (!df) {
    return null;
  }

  try {
    let script: string | null = null;

    switch (dialogId) {
      case 'sort': {
        const cols = Array.isArray(state['sortColumns']) ? state['sortColumns'] as Array<Record<string, unknown>> : [];
        const sortColumns: SortColumn[] = cols
          .map((c) => ({ column: str(c['column']).trim(), descending: Boolean(c['descending']) }))
          .filter((s) => s.column);
        if (!sortColumns.length) return null;
        script = buildSort({ dataframe: df, sortColumns }).toScript();
        break;
      }
      case 'rename': {
        const oldName = str(state['oldName']).trim();
        const newName = str(state['newName']).trim();
        if (!oldName || !newName) return null;
        script = buildRename({ dataframe: df, oldName, newName }).toScript();
        break;
      }
      case 'calculate': {
        const newColumnName = str(state['newColumnName']).trim() || 'new_col';
        const calcType = (str(state['calcType']) || 'formula').trim() as 'formula' | 'sum' | 'mean' | 'diff' | 'ratio';
        const formula = str(state['formula']).trim();
        const selectedCols = Array.isArray(state['selectedCols'])
          ? (state['selectedCols'] as string[]).map(String).filter(Boolean)
          : undefined;
        const columnA = str(state['columnA']).trim() || undefined;
        const columnB = str(state['columnB']).trim() || undefined;
        if (calcType === 'formula' && !formula) return null;
        if ((calcType === 'sum' || calcType === 'mean') && (!selectedCols || selectedCols.length === 0)) return null;
        if ((calcType === 'diff' || calcType === 'ratio') && (!columnA || !columnB)) return null;
        script = buildCalculate({
          dataframe: df,
          newColumnName,
          calcType,
          formula: calcType === 'formula' ? formula || 'NA' : undefined,
          selectedCols,
          columnA,
          columnB,
        }).toScript();
        break;
      }
      case 'recode': {
        const sourceColumn = str(state['sourceColumn']).trim();
        const rawMappings = Array.isArray(state['mappings']) ? state['mappings'] as Array<Record<string, unknown>> : [];
        const mappings: RecodeMapping[] = rawMappings
          .map((m) => ({ from: str(m['from']), to: str(m['to']) }))
          .filter((m) => m.from !== '' || m.to !== '');
        if (!df || !sourceColumn || mappings.length === 0) return null;
        const newColumnName = str(state['newColumnName']).trim() || undefined;
        const defaultValue = str(state['defaultValue']).trim() || undefined;
        script = buildRecode({ dataframe: df, sourceColumn, mappings, newColumnName, defaultValue }).toScript();
        break;
      }
      case 'correlation-generic':
      case 'correlation': {
        const selectedVars = Array.isArray(state['selectedVars']) ? (state['selectedVars'] as string[]).map(String).filter(Boolean) : [];
        if (selectedVars.length < 2) return null;
        const method = (str(state['method']) || 'pearson') as 'pearson' | 'spearman' | 'kendall';
        const showPValues = state['showPValues'] === true;
        script = buildCorrelation({ dataframe: df, selectedVars, method, showPValues }).toScript();
        break;
      }
      case 'regression-generic':
      case 'regression': {
        const responseVar = str(state['responseVar']).trim();
        const predictorVars = Array.isArray(state['predictorVars']) ? (state['predictorVars'] as string[]).map(String).filter(Boolean) : [];
        if (!responseVar || predictorVars.length === 0) return null;
        const modelName = str(state['modelName']).trim() || undefined;
        script = buildRegression({
          dataframe: df,
          responseVar,
          predictorVars,
          modelName,
          showSummary: state['showSummary'] === true,
          showAnova: state['showAnova'] === true,
          plotDiagnostics: state['plotDiagnostics'] === true,
        }).toScript();
        break;
      }
      case 't-test-generic':
      case 't-test': {
        const testType = (str(state['testType']) || 'one') as 'one' | 'two' | 'paired';
        const variable1 = str(state['variable1']).trim();
        if (!variable1) return null;
        const alternative = (str(state['alternative']) || 'two.sided') as 'two.sided' | 'less' | 'greater';
        const confLevel = str(state['confLevel']) || '0.95';
        if (testType === 'one') {
          const mu = str(state['mu']).trim() || '0';
          script = buildTTest({ dataframe: df, testType: 'one', variable1, mu, alternative, confLevel }).toScript();
        } else if (testType === 'two') {
          const groupVar = str(state['groupVar']).trim();
          if (!groupVar) return null;
          script = buildTTest({ dataframe: df, testType: 'two', variable1, groupVar, alternative, confLevel }).toScript();
        } else {
          const variable2 = str(state['variable2']).trim();
          if (!variable2) return null;
          script = buildTTest({ dataframe: df, testType: 'paired', variable1, variable2, alternative, confLevel }).toScript();
        }
        break;
      }
      case 'histogram': {
        const variable = str(state['variable']).trim();
        if (!variable) return null;
        const bins = typeof state['bins'] === 'number' ? state['bins'] : undefined;
        const fillColor = str(state['fillColor']) || undefined;
        const facetBy = str(state['facetBy']).trim() || undefined;
        const title = str(state['title']).trim() || undefined;
        script = buildHistogram({ dataframe: df, variable, bins, fillColor, facetBy, title }).toScript();
        break;
      }
      case 'boxplot-generic':
      case 'boxplot': {
        const yVariable = str(state['yVariable']).trim();
        if (!yVariable) return null;
        const xVariable = str(state['xVariable']).trim() || undefined;
        const fillVariable = str(state['fillVariable']).trim() || undefined;
        const showPoints = state['showPoints'] === true;
        script = buildBoxplot({ dataframe: df, yVariable, xVariable, fillVariable, showPoints }).toScript();
        break;
      }
      case 'scatter': {
        const xVariable = str(state['xVariable']).trim();
        const yVariable = str(state['yVariable']).trim();
        if (!xVariable || !yVariable) return null;
        const colorVariable = str(state['colorVariable']).trim() || undefined;
        const addTrendLine = state['addTrendLine'] === true;
        script = buildScatter({ dataframe: df, xVariable, yVariable, colorVariable, addTrendLine }).toScript();
        break;
      }
      case 'bar-chart': {
        const xVariable = str(state['xVariable']).trim();
        if (!xVariable) return null;
        const chartType = (str(state['chartType']) || '').trim() as 'frequency' | 'value' | '';
        const yVariable = str(state['yVariable']).trim();
        const type: 'frequency' | 'value' = chartType === 'value' || (chartType !== 'frequency' && yVariable) ? 'value' : 'frequency';
        const fillVariable = str(state['fillVariable']).trim() || undefined;
        const position = (str(state['position']) || undefined) as 'stack' | 'dodge' | 'fill' | undefined;
        const horizontal = state['horizontal'] === true;
        const title = str(state['title']).trim() || undefined;
        if (type === 'value' && !yVariable) return null;
        if (type === 'value') {
          script = buildBarChart({
            dataframe: df,
            type: 'value',
            xVariable,
            yVariable,
            fillVariable,
            position,
            horizontal,
            title,
          }).toScript();
        } else {
          script = buildBarChart({
            dataframe: df,
            type: 'frequency',
            xVariable,
            fillVariable,
            position,
            horizontal,
            title,
          }).toScript();
        }
        break;
      }
      case 'duplicate-columns': {
        const sourceColumn = str(state['sourceColumn']).trim();
        const newColumnName = str(state['newColumnName']).trim();
        if (!sourceColumn || !newColumnName) return null;
        script = buildDuplicateColumn({ dataframe: df, sourceColumn, newColumnName }).toScript();
        break;
      }
      case 'permute-column': {
        const column = str(state['column']).trim();
        if (!column) return null;
        script = buildPermuteColumn({ dataframe: df, column }).toScript();
        break;
      }
      case 'delete-columns': {
        const columns = Array.isArray(state['columns'])
          ? (state['columns'] as string[]).map(String).filter(Boolean)
          : [];
        if (columns.length === 0) return null;
        script = buildDeleteColumns({ dataframe: df, columns }).toScript();
        break;
      }
      case 'insert-column': {
        const columnName = str(state['columnName']).trim();
        if (!columnName) return null;
        const columnType = (str(state['columnType']) || 'numeric') as 'numeric' | 'character' | 'logical';
        const position = (str(state['position']) || 'last') as 'first' | 'last' | 'after';
        const afterColumn = str(state['afterColumn']).trim() || undefined;
        script = buildInsertColumn({ dataframe: df, columnName, columnType, position, afterColumn }).toScript();
        break;
      }
      default:
        return null;
    }

    if (!script || isPlaceholder(script)) return null;
    return script;
  } catch {
    return null;
  }
}
