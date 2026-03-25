import type { OperationSpec } from '../operation-spec';
import { p } from '../../dialog-schema.registry';
import { registerOperationSpec } from '../operation-spec.registry';

const spec: OperationSpec = {
  dialogId: 'delete-columns',
  title: 'Delete Columns',
  family: 'data-preparation',
  description: 'Remove one or more columns from a dataframe.',
  operations: ['data.delete_columns'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('columns', 'column[]', { required: true, columnType: 'any' }),
  ],
  retrievalHints: {
    keywords: ['delete', 'remove', 'drop', 'columns'],
  },
};

registerOperationSpec(spec);

export default spec;
