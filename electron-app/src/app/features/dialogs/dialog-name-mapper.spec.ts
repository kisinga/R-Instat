import { mapComponentTypeToDialogId } from './dialog-name-mapper';

describe('dialog name mapper', () => {
  it('maps canonical component types to dialog ids', () => {
    expect(mapComponentTypeToDialogId('HistogramDialogComponent')).toBe('histogram');
    expect(mapComponentTypeToDialogId('MergeDialogComponent')).toBe('merge');
    expect(mapComponentTypeToDialogId('LinePlotDialogComponent')).toBe('line-plot');
  });

  it('maps underscore-prefixed component types from transpiled metadata', () => {
    expect(mapComponentTypeToDialogId('_HistogramDialogComponent')).toBe('histogram');
  });

  it('returns null for unknown component types', () => {
    expect(mapComponentTypeToDialogId('UnknownDialogComponent')).toBeNull();
  });
});
