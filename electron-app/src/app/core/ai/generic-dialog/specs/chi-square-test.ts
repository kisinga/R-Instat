/**
 * Chi-Square Test — Generic dialog spec
 *
 * VB.NET: dlgChiSquareTest.vb (~34 lines of logic)
 * Generic spec: ~30 lines
 * Port time: ~3 minutes
 *
 * Wraps chisq.test() for testing independence between categorical variables.
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'chi-square-test',
  componentType: 'GenericDialogComponent',
  title: 'Chi-Square Test',
  family: 'inferential',
  description: 'Chi-square test of independence between factor columns.',
  operations: ['test.independence.factor_factor'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('columns', 'column[]', { required: true, filter: 'factor', label: 'Variables' }),
    p('correct', 'boolean', { default: true, label: 'Apply Yates continuity correction' }),
    p('simulate', 'boolean', { default: false, label: 'Simulate p-value (Monte Carlo)' }),
    p('replicates', 'number', {
      default: 2000, min: 100, max: 100000,
      label: 'Simulation replicates',
      when: { param: 'simulate', equals: true },
    }),
  ],
  retrievalHints: {
    keywords: ['chi-square', 'chi-squared', 'independence', 'contingency', 'categorical', 'factor'],
  },
  validate: (state) => {
    const cols = state['columns'];
    if (!Array.isArray(cols) || cols.length < 2) {
      return 'Select at least 2 factor variables';
    }
    return null;
  },
  build: (state) => {
    const df = state['dataframe'] as string;
    const cols = state['columns'] as string[];
    if (!df || !cols || cols.length < 2) return null;

    const tableExpr = cols.length === 2
      ? `table(${df}$${cols[0]}, ${df}$${cols[1]})`
      : `table(${cols.map(c => `${df}$${c}`).join(', ')})`;

    let code = `chisq.test(${tableExpr}`;
    if (state['correct'] === false) code += ', correct = FALSE';
    if (state['simulate'] === true) {
      code += ', simulate.p.value = TRUE';
      const reps = state['replicates'] ?? 2000;
      if (reps !== 2000) code += `, B = ${reps}`;
    }
    code += ')';
    return code;
  },
};

registerDialogSpec(spec);
export default spec;
