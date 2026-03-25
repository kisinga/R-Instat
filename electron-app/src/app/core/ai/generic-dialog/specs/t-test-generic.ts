/**
 * t-Test — Generic dialog spec
 *
 * This is a generic-spec reimplementation of the custom TTestDialogComponent
 * (electron-app/src/app/features/dialogs/t-test/t-test-dialog.component.ts)
 * to demonstrate the generic dialog system on a non-trivial dialog.
 *
 * The custom component is 300 lines. This spec is ~40 lines.
 *
 * Complexity exercised:
 * - 3 branching modes (one-sample, two-sample, paired) via testType enum
 * - 3 `when` conditions: variable2 (paired), groupVar (two), mu (one)
 * - Mixed column types: numeric for variables, factor for groupVar
 * - Custom validation: groupVar required when two-sample, variable2 when paired
 *
 * R code generation: reuses the existing `compileStepToR('t-test', state)`
 * which dispatches to `buildTTest()` in statistics.ts.
 *
 * Legacy VB.NET: instat/dlgOneSample.vb (one-sample path)
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 't-test-generic',
  componentType: 'GenericDialogComponent',
  title: 't-Test (Generic)',
  family: 'inferential',
  description: 'One-sample, two-sample, or paired t-test.',
  operations: ['inferential.t_test'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('testType', 'enum', { required: true, enumValues: ['one', 'two', 'paired'], label: 'Test Type', default: 'one' }),
    p('variable1', 'column', { required: true, columnType: 'numeric', label: 'Variable' }),
    p('mu', 'number', { when: { param: 'testType', equals: 'one' }, label: 'Test Value (μ₀)', default: 0 }),
    p('groupVar', 'column', { columnType: 'factor', when: { param: 'testType', equals: 'two' }, label: 'Grouping Variable' }),
    p('variable2', 'column', { columnType: 'numeric', when: { param: 'testType', equals: 'paired' }, label: 'Second Variable' }),
    p('alternative', 'enum', { enumValues: ['two.sided', 'less', 'greater'], label: 'Alternative Hypothesis', default: 'two.sided', group: 'Options' }),
    p('confLevel', 'enum', { enumValues: ['0.90', '0.95', '0.99'], label: 'Confidence Level', default: '0.95', group: 'Options' }),
  ],
  retrievalHints: {
    keywords: ['t-test', 'ttest', 'hypothesis', 'one-sample', 'two-sample', 'paired'],
  },
  validate: (state) => {
    const testType = state['testType'];
    if (testType === 'two' && !state['groupVar']) {
      return 'Grouping variable is required for two-sample t-test';
    }
    if (testType === 'paired' && !state['variable2']) {
      return 'Second variable is required for paired t-test';
    }
    return null;
  },
};

registerDialogSpec(spec);

export default spec;
