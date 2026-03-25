/**
 * Frequency Table — Generic dialog spec
 *
 * VB.NET: dlgFlatFrequencyTable.vb (~125 lines)
 * Generic spec: ~45 lines
 * Port time: ~4 minutes
 *
 * Wraps ftable() for flat cross-tabulation of factor variables.
 * Two column receivers (row vars, column var) + margins option.
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'frequency-table',
  componentType: 'GenericDialogComponent',
  title: 'Frequency Table',
  family: 'inferential',
  description: 'Cross-tabulation frequency table with optional margins.',
  operations: ['describe.distribution.factor'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('rowVars', 'column[]', { required: true, filter: 'factor', label: 'Row Variable(s)' }),
    p('colVar', 'column', { required: true, filter: 'factor', label: 'Column Variable' }),
    p('addMargins', 'boolean', { default: false, label: 'Add margins (totals)' }),
  ],
  retrievalHints: {
    keywords: ['frequency', 'table', 'cross-tabulation', 'contingency', 'ftable', 'count'],
  },
  validate: (state) => {
    const rowVars = state['rowVars'];
    if (!Array.isArray(rowVars) || rowVars.length === 0) {
      return 'Select at least one row variable';
    }
    if (!state['colVar']) return 'Select a column variable';
    return null;
  },
  build: (state) => {
    const df = state['dataframe'] as string;
    const rowVars = state['rowVars'] as string[];
    const colVar = state['colVar'] as string;
    if (!df || !rowVars?.length || !colVar) return null;

    const rowVarStr = rowVars.map(v => `"${v}"`).join(', ');
    let code = `ftable(table(${[...rowVars, colVar].map(c => `${df}$${c}`).join(', ')}), row.vars = c(${rowVarStr}), col.vars = "${colVar}")`;

    if (state['addMargins'] === true) {
      code = `addmargins(${code})`;
    }
    return code;
  },
};

registerDialogSpec(spec);
export default spec;
