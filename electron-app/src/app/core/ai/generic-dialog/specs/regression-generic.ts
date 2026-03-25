/**
 * Linear Regression — Generic dialog spec
 *
 * Custom component: 213 lines (regression-dialog.component.ts)
 * Generic spec: ~45 lines
 *
 * Exercises: column[] (multi-select), 3 boolean options, optional string field
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'regression-generic',
  componentType: 'GenericDialogComponent',
  title: 'Linear Regression (Generic)',
  family: 'predictive',
  description: 'Linear model with one or more predictors.',
  operations: ['predictive.linear_regression'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('responseVar', 'column', { required: true, filter: 'numeric', label: 'Response Variable' }),
    p('predictorVars', 'column[]', { required: true, filter: 'any', label: 'Predictor Variables' }),
    p('modelName', 'string', { label: 'Model Name' }),
    p('showSummary', 'boolean', { default: true, label: 'Show Summary', group: 'Output' }),
    p('showAnova', 'boolean', { label: 'Show ANOVA Table', group: 'Output' }),
    p('plotDiagnostics', 'boolean', { label: 'Plot Diagnostics', group: 'Output' }),
  ],
  retrievalHints: {
    keywords: ['regression', 'linear', 'model', 'predict', 'lm', 'anova'],
  },
  validate: (state) => {
    const vars = state['predictorVars'];
    if (!Array.isArray(vars) || vars.length === 0) {
      return 'Select at least one predictor variable';
    }
    return null;
  },
};

registerDialogSpec(spec);

export default spec;
