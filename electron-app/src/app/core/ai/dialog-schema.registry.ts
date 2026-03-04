/**
 * Dialog Schema Registry
 *
 * Strict schema used by:
 * - AI prompt/tool grounding
 * - Validation of model-produced state
 */

import { DialogContractV2Registry } from './dialog-contract-v2.registry';

export type ParamKind =
  | 'dataframe'
  | 'column'
  | 'column[]'
  | 'string[]'
  | 'enum'
  | 'boolean'
  | 'number'
  | 'string'
  | 'object[]';

export type ColumnTypeHint = 'numeric' | 'factor' | 'date' | 'any';

export interface ParamCondition {
  param: string;
  equals: string | number | boolean;
}

export interface DialogParamSchema {
  name: string;
  kind: ParamKind;
  required?: boolean;
  columnType?: ColumnTypeHint;
  enumValues?: string[];
  min?: number;
  max?: number;
  when?: ParamCondition;
}

export interface DialogSchema {
  dialogId: string;
  description: string;
  operations: string[];
  params: DialogParamSchema[];
}

const p = (
  name: string,
  kind: ParamKind,
  opts: Omit<DialogParamSchema, 'name' | 'kind'> = {}
): DialogParamSchema => ({ name, kind, ...opts });

export const DIALOG_SCHEMAS: DialogSchema[] = [
  ...DialogContractV2Registry.getSchemas(),
  {
    dialogId: 'boxplot',
    description: 'Boxplot comparing numeric variable across groups.',
    operations: ['describe.comparison.numeric_by_group'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('yVariable', 'column', { required: true, columnType: 'numeric' }),
      p('xVariable', 'column', { columnType: 'factor' }),
      p('fillVariable', 'column', { columnType: 'factor' }),
      p('showPoints', 'boolean'),
    ],
  },
  {
    dialogId: 'scatter',
    description: 'Scatter plot of two numeric variables.',
    operations: ['describe.association.numeric_numeric'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('xVariable', 'column', { required: true, columnType: 'numeric' }),
      p('yVariable', 'column', { required: true, columnType: 'numeric' }),
      p('colorVariable', 'column', { columnType: 'factor' }),
      p('addTrendLine', 'boolean'),
    ],
  },
  {
    dialogId: 'correlation',
    description: 'Correlation matrix between numeric variables.',
    operations: ['describe.association.numeric_numeric'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('selectedVars', 'column[]', { required: true, columnType: 'numeric' }),
      p('method', 'enum', { enumValues: ['pearson', 'spearman', 'kendall'] }),
      p('showPValues', 'boolean'),
    ],
  },
  {
    dialogId: 't-test',
    description: 'One-sample, two-sample, or paired t-test.',
    operations: ['inferential.t_test'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('testType', 'enum', { required: true, enumValues: ['one', 'two', 'paired'] }),
      p('variable1', 'column', { required: true, columnType: 'numeric' }),
      p('variable2', 'column', { columnType: 'numeric', when: { param: 'testType', equals: 'paired' } }),
      p('groupVar', 'column', { columnType: 'factor', when: { param: 'testType', equals: 'two' } }),
      p('mu', 'number', { when: { param: 'testType', equals: 'one' } }),
      p('alternative', 'enum', { enumValues: ['two.sided', 'less', 'greater'] }),
      p('confLevel', 'enum', { enumValues: ['0.90', '0.95', '0.99'] }),
    ],
  },
  {
    dialogId: 'regression',
    description: 'Linear regression with one response and predictors.',
    operations: ['predictive.linear_regression'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('responseVar', 'column', { required: true, columnType: 'numeric' }),
      p('predictorVars', 'column[]', { required: true, columnType: 'any' }),
      p('modelName', 'string'),
      p('showSummary', 'boolean'),
      p('showAnova', 'boolean'),
      p('plotDiagnostics', 'boolean'),
    ],
  },
  {
    dialogId: 'summary',
    description: 'Summary statistics for selected columns.',
    operations: ['describe.comparison.numeric_by_group'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('selectedColumns', 'column[]', { required: true, columnType: 'any' }),
      p('groupByColumn', 'column', { columnType: 'factor' }),
      p('summaryMode', 'enum', { enumValues: ['default', 'customised', 'skim'] }),
      p('selectedStatistics', 'string[]'),
      p('omitMissing', 'boolean'),
    ],
  },
  {
    dialogId: 'filter',
    description: 'Filter rows using one or more conditions.',
    operations: ['data.filter'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('conditions', 'object[]', { required: true }),
      p('combineLogic', 'enum', { enumValues: ['and', 'or', '&', '|'] }),
    ],
  },
  {
    dialogId: 'sort',
    description: 'Sort rows by one or more columns.',
    operations: ['data.sort'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('sortColumns', 'object[]', { required: true }),
    ],
  },
  {
    dialogId: 'calculate',
    description: 'Create a new derived column from formula/arithmetic.',
    operations: ['data.calculate'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('newColumnName', 'string', { required: true }),
      p('calcType', 'enum', { required: true, enumValues: ['formula', 'sum', 'mean', 'diff', 'ratio'] }),
      p('formula', 'string', { when: { param: 'calcType', equals: 'formula' } }),
      p('selectedCols', 'column[]', { columnType: 'numeric', when: { param: 'calcType', equals: 'sum' } }),
      p('selectedCols', 'column[]', { columnType: 'numeric', when: { param: 'calcType', equals: 'mean' } }),
      p('columnA', 'column', { columnType: 'numeric', when: { param: 'calcType', equals: 'diff' } }),
      p('columnB', 'column', { columnType: 'numeric', when: { param: 'calcType', equals: 'diff' } }),
      p('columnA', 'column', { columnType: 'numeric', when: { param: 'calcType', equals: 'ratio' } }),
      p('columnB', 'column', { columnType: 'numeric', when: { param: 'calcType', equals: 'ratio' } }),
    ],
  },
  {
    dialogId: 'rename',
    description: 'Rename one column.',
    operations: ['data.rename'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('oldName', 'column', { required: true, columnType: 'any' }),
      p('newName', 'string', { required: true }),
    ],
  },
  {
    dialogId: 'merge',
    description: 'Merge two dataframes using dplyr join operations.',
    operations: ['data.reshape'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('secondDataframe', 'dataframe', { required: true }),
      p('joinType', 'enum', {
        enumValues: ['full_join', 'left_join', 'right_join', 'inner_join', 'semi_join', 'anti_join'],
      }),
      p('joinColumn1', 'column', { columnType: 'any' }),
      p('joinColumn2', 'column', { columnType: 'any' }),
      p('resultName', 'string', { required: true }),
    ],
  },
  {
    dialogId: 'stack',
    description: 'Stack selected columns from wide to long format.',
    operations: ['data.reshape'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('columnsToStack', 'column[]', { required: true, columnType: 'any' }),
      p('namesTo', 'string', { required: true }),
      p('valuesTo', 'string', { required: true }),
      p('dropNA', 'boolean'),
      p('resultName', 'string', { required: true }),
    ],
  },
  {
    dialogId: 'unstack',
    description: 'Unstack long-format data to wide format.',
    operations: ['data.reshape'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('namesFrom', 'column', { required: true, columnType: 'factor' }),
      p('valuesFrom', 'column', { required: true, columnType: 'numeric' }),
      p('valuesFill', 'string'),
      p('resultName', 'string', { required: true }),
    ],
  },
  {
    dialogId: 'line-plot',
    description: 'Line plot with optional group coloring, points, and smoothing.',
    operations: ['describe.association.numeric_series'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('xVariable', 'column', { required: true, columnType: 'any' }),
      p('yVariable', 'column', { required: true, columnType: 'numeric' }),
      p('groupBy', 'column', { columnType: 'factor' }),
      p('showPoints', 'boolean'),
      p('smoothLine', 'boolean'),
    ],
  },
  {
    dialogId: 'dot-plot',
    description: 'Dot plot with optional fill grouping and stack direction.',
    operations: ['describe.association.numeric_series'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('xVariable', 'column', { required: true, columnType: 'factor' }),
      p('yVariable', 'column', { required: true, columnType: 'numeric' }),
      p('fillBy', 'column', { columnType: 'factor' }),
      p('dotSize', 'number', { min: 0.1, max: 2 }),
      p('stackDirection', 'enum', { enumValues: ['center', 'up', 'down'] }),
    ],
  },
  {
    dialogId: 'climatic-summary',
    description: 'Climatic aggregation by annual/monthly/daily/station levels.',
    operations: ['climatic.summary'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('elementColumn', 'column', { required: true, columnType: 'numeric' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
      p('summaryLevel', 'enum', { enumValues: ['annual', 'monthly', 'daily', 'station'] }),
      p('summaryFunction', 'enum', { enumValues: ['sum', 'mean', 'max', 'min', 'count', 'count_missing'] }),
      p('omitMissing', 'boolean'),
    ],
  },
  {
    dialogId: 'annual-rainfall',
    description: 'Sum rainfall by year and station.',
    operations: ['climatic.summary'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('rainColumn', 'column', { required: true, columnType: 'numeric' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
    ],
  },
  {
    dialogId: 'extremes',
    description: 'Find max/min climatic values by period.',
    operations: ['climatic.extremes'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('elementColumn', 'column', { required: true, columnType: 'numeric' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
      p('level', 'enum', { enumValues: ['annual', 'monthly'] }),
      p('findMax', 'boolean'),
      p('findMin', 'boolean'),
    ],
  },
  {
    dialogId: 'day-count',
    description: 'Count days matching threshold criteria.',
    operations: ['climatic.threshold_days'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('elementColumn', 'column', { required: true, columnType: 'numeric' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
      p('operator', 'enum', { enumValues: ['>', '>=', '<', '<=', '==', '!='] }),
      p('threshold', 'number'),
    ],
  },
  {
    dialogId: 'spell-lengths',
    description: 'Wet/dry spell length analysis.',
    operations: ['climatic.threshold_days'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('elementColumn', 'column', { required: true, columnType: 'numeric' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
      p('spellType', 'enum', { enumValues: ['wet', 'dry'] }),
      p('threshold', 'number'),
      p('statistic', 'enum', { enumValues: ['max', 'mean', 'sum', 'count'] }),
    ],
  },
  {
    dialogId: 'seasonal-summary',
    description: 'Seasonal climatic summary.',
    operations: ['climatic.summary'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('elementColumn', 'column', { required: true, columnType: 'numeric' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
      p('summaryFunction', 'enum', { enumValues: ['sum', 'mean', 'max', 'min', 'count'] }),
    ],
  },
  {
    dialogId: 'missing-report',
    description: 'Missing values report by period.',
    operations: ['climatic.summary'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
      p('elementColumns', 'column[]', { required: true, columnType: 'numeric' }),
      p('level', 'enum', { enumValues: ['annual', 'monthly'] }),
    ],
  },
  {
    dialogId: 'temperature-summary',
    description: 'Temperature summary by period.',
    operations: ['climatic.summary'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
      p('tmaxColumn', 'column', { required: true, columnType: 'numeric' }),
      p('tminColumn', 'column', { required: true, columnType: 'numeric' }),
      p('level', 'enum', { enumValues: ['annual', 'monthly', 'daily'] }),
    ],
  },
  {
    dialogId: 'inventory-plot',
    description: 'Data availability heatmap.',
    operations: ['climatic.summary'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('dateColumn', 'column', { required: true, columnType: 'date' }),
      p('elementColumn', 'column', { required: true, columnType: 'numeric' }),
      p('stationColumn', 'column', { columnType: 'factor' }),
      p('plotTitle', 'string'),
      p('facetByStation', 'boolean'),
      p('flipCoords', 'boolean'),
      p('presentColor', 'string'),
      p('missingColor', 'string'),
    ],
  },
];

const SCHEMA_BY_ID = new Map<string, DialogSchema>(DIALOG_SCHEMAS.map((s) => [s.dialogId, s]));

export function getSchema(dialogId: string): DialogSchema | undefined {
  return SCHEMA_BY_ID.get(dialogId);
}

export function getSchemaSummaryForPrompt(): Array<{
  dialogId: string;
  description: string;
  operations: string[];
  params: Array<{
    name: string;
    kind: ParamKind;
    required?: boolean;
    columnType?: ColumnTypeHint;
    enumValues?: string[];
    when?: ParamCondition;
  }>;
}> {
  return DIALOG_SCHEMAS.map((s) => ({
    dialogId: s.dialogId,
    description: s.description,
    operations: s.operations,
    params: s.params.map((x) => ({
      name: x.name,
      kind: x.kind,
      required: x.required,
      columnType: x.columnType,
      enumValues: x.enumValues,
      when: x.when,
    })),
  }));
}
