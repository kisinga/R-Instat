import type { OperationSpec } from '../operation-spec';
import { p } from '../../dialog-schema.registry';
import { registerOperationSpec } from '../operation-spec.registry';

const spec: OperationSpec = {
  dialogId: 'duplicate-columns',
  title: 'Duplicate Column',
  family: 'data-preparation',
  description: 'Copy a column under a new name.',
  operations: ['data.duplicate_column'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('sourceColumn', 'column', { required: true, columnType: 'any' }),
    p('newColumnName', 'string', { required: true }),
  ],
  retrievalHints: {
    keywords: ['duplicate', 'copy', 'clone', 'column'],
  },
};

registerOperationSpec(spec);

export default spec;
