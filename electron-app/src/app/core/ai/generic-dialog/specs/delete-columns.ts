import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'delete-columns',
  componentType: 'GenericDialogComponent',
  title: 'Delete Columns',
  family: 'data-preparation',
  description: 'Remove one or more columns from a dataframe.',
  operations: ['data.delete_columns'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('columns', 'column[]', { required: true, filter: 'any' }),
  ],
  retrievalHints: {
    keywords: ['delete', 'remove', 'drop', 'columns'],
  },
};

registerDialogSpec(spec);

export default spec;
