import type { OperationSpec } from '../operation-spec';
import { p } from '../../dialog-schema.registry';
import { registerOperationSpec } from '../operation-spec.registry';

const spec: OperationSpec = {
  dialogId: 'permute-column',
  title: 'Permute Column',
  family: 'data-preparation',
  description: 'Randomly shuffle the values in a column.',
  operations: ['data.permute_column'],
  params: [
    p('dataframe', 'dataframe', { required: true }),
    p('column', 'column', { required: true, columnType: 'any' }),
  ],
  retrievalHints: {
    keywords: ['permute', 'shuffle', 'randomize', 'random order', 'column'],
  },
};

registerOperationSpec(spec);

export default spec;
