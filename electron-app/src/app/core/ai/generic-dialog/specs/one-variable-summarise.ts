/**
 * One Variable Summarise — Generic dialog spec
 *
 * VB.NET ground truth: dlgOneVariableSummarise.vb (403 lines)
 *
 * Three modes:
 * - Default: R summary() with configurable maxsum
 * - Skim: skimr::skim_without_charts()
 * - Customised: $summary_table() -> pivot_wider() -> gt::gt()
 */

import type { DialogContract } from '../../dialog-catalog';
import type { ChecklistOption } from '../../dialog-schema.registry';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';
import { registerBuilder } from '../../../dialogs/builders/builder-registry';
import { rSyntax } from '../../../r-codegen';

const SUMMARY_OPTIONS: ChecklistOption[] = [
  { key: 'summary_count', label: 'N (Non Missing)', category: 'Basic' },
  { key: 'summary_count_miss', label: 'N Missing', category: 'Basic' },
  { key: 'summary_count_all', label: 'N Total', category: 'Basic' },
  { key: 'summary_mean', label: 'Mean', category: 'Basic' },
  { key: 'summary_sd', label: 'Std Dev', category: 'Basic' },
  { key: 'summary_min', label: 'Minimum', category: 'Basic' },
  { key: 'summary_max', label: 'Maximum', category: 'Basic' },
  { key: 'summary_median', label: 'Median', category: 'Basic' },
  { key: 'summary_sum', label: 'Sum', category: 'Basic' },
  { key: 'summary_range', label: 'Range', category: 'Basic' },
  { key: 'summary_var', label: 'Variance', category: 'Basic' },
  { key: 'summary_mode', label: 'Mode', category: 'Basic' },
  { key: 'summary_kurtosis', label: 'Kurtosis', category: 'Advanced' },
  { key: 'summary_skewness', label: 'Skewness', category: 'Advanced' },
  { key: 'summary_coef_var', label: 'Coeff. of Variation', category: 'Advanced' },
  { key: 'summary_median_absolute_deviation', label: 'MAD', category: 'Advanced' },
  { key: 'summary_n_distinct', label: 'N Distinct', category: 'Advanced' },
  { key: 'standard_error_mean', label: 'Std Error of Mean', category: 'Advanced' },
  { key: 'summary_trimmed_mean', label: 'Trimmed Mean', category: 'Advanced' },
  { key: 'p10', label: '10th', category: 'Percentiles' },
  { key: 'p25', label: '25th (Q1)', category: 'Percentiles' },
  { key: 'p50', label: '50th (Median)', category: 'Percentiles' },
  { key: 'p75', label: '75th (Q3)', category: 'Percentiles' },
  { key: 'p90', label: '90th', category: 'Percentiles' },
];

registerBuilder('one-variable-summarise', (state) => {
  const df = state['dataframe'] as string;
  const cols = state['columns'] as string[];
  if (!df || !cols?.length) return rSyntax().setBase('# Select variables to summarise');

  const mode = (state['mode'] as string) || 'default';
  const colsVec = cols.map(c => `"${c}"`).join(', ');

  switch (mode) {
    case 'default': {
      const maxsum = state['maxsum'] ?? 12;
      return rSyntax().setBase(`summary(get_dataframe("${df}")[, c(${colsVec}), drop = FALSE], maxsum = ${maxsum})`);
    }
    case 'skim':
      return rSyntax().setBase(`skimr::skim_without_charts(get_dataframe("${df}"), ${cols.join(', ')})`);

    case 'customised': {
      const summaries = state['summaries'] as string[];
      if (!summaries?.length) return rSyntax().setBase('# Select at least one summary statistic');

      const naRm = state['naRm'] === true ? 'TRUE' : 'FALSE';
      const columnFactor = (state['columnFactor'] as string) || 'summary';
      const naDisplay = state['naDisplay'] as string | undefined;
      const summVec = summaries.map(s => `"${s}"`).join(', ');

      let code = `data_book$summary_table(\n`;
      code += `  data_name = "${df}",\n`;
      code += `  columns_to_summarise = c(${colsVec}),\n`;
      code += `  summaries = c(${summVec}),\n`;
      code += `  treat_columns_as_factor = TRUE,\n`;
      code += `  na.rm = ${naRm}`;
      if (naDisplay && naDisplay !== 'NA') code += `,\n  na_display = "${naDisplay}"`;
      code += `\n)`;
      if (columnFactor !== 'none') {
        code += ` %>%\n  tidyr::pivot_wider(names_from = "${columnFactor === 'summary' ? 'summary' : 'variable'}", values_from = "value")`;
      }
      code += ` %>%\n  gt::gt()`;
      return rSyntax().setBase(code);
    }
    default:
      return rSyntax().setBase('# Unknown summary mode');
  }
});

const spec: DialogContract = {
  dialogId: 'one-variable-summarise',
  componentType: 'GenericDialogComponent',
  builderId: 'one-variable-summarise',
  title: 'One Variable Summarise',
  family: 'inferential',
  description: 'Summary statistics for selected columns (default R summary, skimr, or custom summary table with gt output).',
  operations: ['describe.summary.one_variable'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('columns', 'column[]', { required: true, label: 'Variables to Summarise' }),
    p('mode', 'enum', { required: true, enumValues: ['default', 'customised', 'skim'], default: 'default', label: 'Summary Type' }),
    p('maxsum', 'number', { min: 1, max: 100, default: 12, label: 'Max Categories to Show',
        when: { param: 'mode', equals: 'default' } }),
    p('summaries', 'checklist', {
      required: true, options: SUMMARY_OPTIONS, reorderable: true,
      default: ['summary_count', 'summary_count_all', 'summary_sum'],
      label: 'Summary Functions',
      when: { param: 'mode', equals: 'customised' },
    }),
    p('naRm', 'boolean', { default: false, label: 'Omit Missing Values',
        when: { param: 'mode', equals: 'customised' } }),
    p('columnFactor', 'enum', {
      enumValues: ['none', 'summary', 'variable'], default: 'summary',
      label: 'Column Layout',
      when: { param: 'mode', equals: 'customised' },
      group: 'Display Options' }),
    p('naDisplay', 'enum', {
      enumValues: ['NA', '(blank)', '.', '...', '---'], default: 'NA',
      label: 'Display Missing As',
      when: { param: 'mode', equals: 'customised' },
      group: 'Display Options' }),
  ],
  retrievalHints: {
    keywords: ['summary', 'summarise', 'describe', 'statistics', 'mean', 'sd', 'count', 'skim', 'gt table'],
  },
  validate: (state) => {
    if (state['mode'] === 'customised') {
      const summaries = state['summaries'];
      if (!Array.isArray(summaries) || summaries.length === 0) return 'Select at least one summary statistic';
    }
    return null;
  },
};

registerDialogSpec(spec);
export default spec;
