import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'insert-column',
  componentType: 'GenericDialogComponent',
  title: 'Insert Column',
  family: 'data-preparation',
  description: 'Add a new empty column to a dataframe.',
  operations: ['data.insert_column'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('columnName', 'string', { required: true }),
    p('columnType', 'enum', { required: true, enumValues: ['numeric', 'character', 'logical'] }),
    p('position', 'enum', { required: true, enumValues: ['first', 'last', 'after'] }),
    p('afterColumn', 'column', { filter: 'any', when: { param: 'position', equals: 'after' } }),
  ],
  retrievalHints: {
    keywords: ['insert', 'add', 'new', 'empty', 'column', 'create'],
  },
};

registerDialogSpec(spec);

export default spec;
