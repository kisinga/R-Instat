/**
 * Convert Column Type — Generic dialog spec
 *
 * VB.NET: dlgConvertColumns.vb (~200 lines)
 * Converts selected columns to a target type.
 */

import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';
import { registerBuilder } from '../../../dialogs/builders/builder-registry';
import { rSyntax } from '../../../r-codegen';

registerBuilder('convert-columns', (state) => {
  const df = state['dataframe'] as string;
  const cols = state['columns'] as string[];
  const targetType = state['targetType'] as string;
  if (!df || !cols?.length || !targetType) return rSyntax().setBase('# Select columns and target type');

  const converterMap: Record<string, string> = {
    factor: 'as.factor', ordered_factor: 'as.ordered', numeric: 'as.numeric',
    integer: 'as.integer', character: 'as.character', logical: 'as.logical', date: 'as.Date',
  };
  const fn = converterMap[targetType] || 'as.character';
  const dateFormat = targetType === 'date' ? `, format = "${state['dateFormat'] || '%Y-%m-%d'}"` : '';

  const lines = cols.map(c => `${df}$\`${c}\` <- ${fn}(${df}$\`${c}\`${dateFormat})`);
  return rSyntax().setBase(lines.join('\n'));
});

const spec: DialogContract = {
  dialogId: 'convert-columns',
  componentType: 'GenericDialogComponent',
  builderId: 'convert-columns',
  title: 'Convert Column Type',
  family: 'data-preparation',
  description: 'Convert columns to a different data type (factor, numeric, character, etc.).',
  operations: ['transform.convert_type'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('columns', 'column[]', { required: true, label: 'Columns to convert' }),
    p('targetType', 'enum', {
      required: true,
      enumValues: ['factor', 'ordered_factor', 'numeric', 'integer', 'character', 'logical', 'date'],
      default: 'factor', label: 'Convert to',
    }),
    p('keepLabels', 'boolean', { default: false, label: 'Preserve labels as factor levels',
      when: { param: 'targetType', equals: 'factor' } }),
    p('dateFormat', 'enum', {
      enumValues: ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d', '%d-%b-%Y'],
      default: '%Y-%m-%d', label: 'Date format',
      when: { param: 'targetType', equals: 'date' },
    }),
  ],
  retrievalHints: {
    keywords: ['convert', 'type', 'factor', 'numeric', 'character', 'date', 'as.', 'coerce', 'cast'],
  },
  validate: (state) => {
    const cols = state['columns'];
    if (!Array.isArray(cols) || cols.length === 0) return 'Select at least one column';
    if (!state['targetType']) return 'Select a target type';
    return null;
  },
};

registerDialogSpec(spec);
export default spec;
