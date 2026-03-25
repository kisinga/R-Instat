import type { DialogContract } from '../../dialog-catalog';
import { p } from '../../dialog-schema.registry';
import { registerDialogSpec } from '../operation-spec.registry';

const spec: DialogContract = {
  dialogId: 'permute-column',
  componentType: 'GenericDialogComponent',
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

registerDialogSpec(spec);

export default spec;
