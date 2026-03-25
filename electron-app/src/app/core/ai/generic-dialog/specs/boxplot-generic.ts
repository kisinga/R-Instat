/**
 * Boxplot — Generic dialog spec
 *
 * Custom component: 179 lines (boxplot-dialog.component.ts)
 * Generic spec: ~35 lines
 *
 * Exercises: mixed column types (numeric required, factor optional), boolean option
 * This is a ggplot dialog — tests whether plotting dialogs can be generic.
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'boxplot-generic',
  componentType: 'GenericDialogComponent',
  title: 'Box Plot (Generic)',
  family: 'plotting',
  description: 'Boxplot of numeric variable, optionally grouped by factor.',
  operations: ['describe.distribution.numeric', 'describe.comparison.numeric_by_group'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('yVariable', 'column', { required: true, filter: 'numeric' }),
    p('xVariable', 'column', { filter: 'factor' }),
    p('fillVariable', 'column', { filter: 'factor' }),
    p('showPoints', 'boolean'),
  ],
  retrievalHints: {
    keywords: ['boxplot', 'box plot', 'box', 'distribution', 'quartile', 'median'],
  },
};

registerDialogSpec(spec);

export default spec;
