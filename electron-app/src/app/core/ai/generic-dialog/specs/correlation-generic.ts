/**
 * Correlation — Generic dialog spec
 *
 * Custom component: 183 lines (correlation-dialog.component.ts)
 * Generic spec: ~40 lines
 *
 * Exercises: column[] with min-2 validation, enum (method), boolean (showPValues)
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'correlation-generic',
  componentType: 'GenericDialogComponent',
  title: 'Correlation (Generic)',
  family: 'inferential',
  description: 'Correlation matrix with optional p-values.',
  operations: ['describe.association.numeric_numeric'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('selectedVars', 'column[]', { required: true, columnType: 'numeric' }),
    p('method', 'enum', { enumValues: ['pearson', 'spearman', 'kendall'] }),
    p('showPValues', 'boolean'),
  ],
  retrievalHints: {
    keywords: ['correlation', 'pearson', 'spearman', 'kendall', 'association', 'relationship'],
  },
  validate: (state) => {
    const vars = state['selectedVars'];
    if (!Array.isArray(vars) || vars.length < 2) {
      return 'Select at least 2 variables';
    }
    return null;
  },
};

registerDialogSpec(spec);

export default spec;
