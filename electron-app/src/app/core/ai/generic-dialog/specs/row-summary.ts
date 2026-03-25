/**
 * Row Summary — Generic dialog spec
 *
 * VB.NET: dlgRowSummary.vb (~250 lines)
 * Generic spec: ~55 lines
 * Port time: ~5 minutes
 *
 * Applies a summary function across columns row-wise using dplyr::rowwise + mutate.
 * Exercises: column[] (multi numeric), enum (function), string (output name), conditional param.
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'row-summary',
  componentType: 'GenericDialogComponent',
  title: 'Row Summary',
  family: 'data-preparation',
  description: 'Compute row-wise summary (mean, sum, min, max, etc.) across selected columns.',
  operations: ['transform.row_summary'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('columns', 'column[]', { required: true, filter: 'numeric', label: 'Columns to summarise' }),
    p('func', 'enum', {
      required: true,
      enumValues: ['mean', 'sum', 'min', 'max', 'median', 'sd'],
      default: 'mean',
      label: 'Summary function',
    }),
    p('naRm', 'boolean', { default: true, label: 'Remove missing values (na.rm)' }),
    p('outputName', 'string', { label: 'Output column name' }),
  ],
  retrievalHints: {
    keywords: ['row', 'summary', 'rowwise', 'row mean', 'row sum', 'row min', 'row max', 'across columns'],
  },
  validate: (state) => {
    const cols = state['columns'];
    if (!Array.isArray(cols) || cols.length < 2) {
      return 'Select at least 2 columns';
    }
    return null;
  },
  build: (state) => {
    const df = state['dataframe'] as string;
    const cols = state['columns'] as string[];
    const func = (state['func'] as string) || 'mean';
    const naRm = state['naRm'] !== false;
    const outputName = (state['outputName'] as string)?.trim() || `row_${func}`;
    if (!df || !cols || cols.length < 2) return null;

    const colList = cols.map(c => `\`${c}\``).join(', ');
    const naRmStr = naRm ? ', na.rm = TRUE' : '';
    return `${df} <- ${df} %>%\n  dplyr::rowwise() %>%\n  dplyr::mutate(${outputName} = ${func}(c(${colList})${naRmStr})) %>%\n  dplyr::ungroup()`;
  },
};

registerDialogSpec(spec);
export default spec;
