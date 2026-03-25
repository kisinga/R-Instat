import type { OperationSpec } from '../operation-spec';
import { p } from '../../dialog-schema.registry';
import { registerOperationSpec } from '../operation-spec.registry';

const spec: OperationSpec = {
  dialogId: 'insert-column',
  title: 'Insert Column',
  family: 'data-preparation',
  description: 'Add a new empty column to a dataframe.',
  operations: ['data.insert_column'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('columnName', 'string', { required: true }),
    p('columnType', 'enum', { required: true, enumValues: ['numeric', 'character', 'logical'] }),
    p('position', 'enum', { required: true, enumValues: ['first', 'last', 'after'] }),
    p('afterColumn', 'column', { columnType: 'any', when: { param: 'position', equals: 'after' } }),
  ],
  retrievalHints: {
    keywords: ['insert', 'add', 'new', 'empty', 'column', 'create'],
  },
};

registerOperationSpec(spec);

export default spec;
