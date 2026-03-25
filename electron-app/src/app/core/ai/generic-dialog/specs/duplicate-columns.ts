import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'duplicate-columns',
  componentType: 'GenericDialogComponent',
  title: 'Duplicate Column',
  family: 'data-preparation',
  description: 'Copy a column under a new name.',
  operations: ['data.duplicate_column'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('sourceColumn', 'column', { required: true, filter: 'any' }),
    p('newColumnName', 'string', { required: true }),
  ],
  retrievalHints: {
    keywords: ['duplicate', 'copy', 'clone', 'column'],
  },
};

registerDialogSpec(spec);

export default spec;
