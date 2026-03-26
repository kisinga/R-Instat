/**
 * Frequency Table — Generic dialog spec
 *
 * VB.NET: dlgFlatFrequencyTable.vb (~125 lines)
 * Wraps ftable() for flat cross-tabulation of factor variables.
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';
import { registerBuilder } from '../../../dialogs/builders/builder-registry';
import { rSyntax } from '../../../r-codegen';

registerBuilder('frequency-table', (state) => {
  const df = state['dataframe'] as string;
  const rowVars = state['rowVars'] as string[];
  const colVar = state['colVar'] as string;
  if (!df || !rowVars?.length || !colVar) return rSyntax().setBase('# Select row and column variables');

  const rowVarStr = rowVars.map(v => `"${v}"`).join(', ');
  let code = `ftable(table(${[...rowVars, colVar].map(c => `${df}$${c}`).join(', ')}), row.vars = c(${rowVarStr}), col.vars = "${colVar}")`;

  if (state['addMargins'] === true) {
    code = `addmargins(${code})`;
  }
  return rSyntax().setBase(code);
});

const spec: DialogContract = {
  dialogId: 'frequency-table',
  componentType: 'GenericDialogComponent',
  builderId: 'frequency-table',
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
    if (!Array.isArray(rowVars) || rowVars.length === 0) return 'Select at least one row variable';
    if (!state['colVar']) return 'Select a column variable';
    return null;
  },
};

registerDialogSpec(spec);
export default spec;
