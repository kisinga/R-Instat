/**
 * Generic Dialog Parity Tests (Layer 2)
 *
 * Validates that each pilot OperationSpec's builder produces correct R code
 * for a set of input fixtures. Pure function tests — no R execution, no TestBed.
 *
 * Each fixture defines:
 * - state: input Record<string, unknown> (as the generic dialog would collect)
 * - expect.notNull: whether compileStepToR should return a script
 * - expect.contains: substrings the script must include
 * - expect.notContains: substrings the script must not include
 */

import { compileStepToR } from '../step-to-r';

// Ensure specs are registered (side-effect imports)
import './specs/duplicate-columns';
import './specs/permute-column';
import './specs/delete-columns';
import './specs/insert-column';

interface SpecFixture {
  label: string;
  state: Record<string, unknown>;
  expect: {
    notNull: boolean;
    contains?: string[];
    notContains?: string[];
  };
}

const FIXTURES: Record<string, SpecFixture[]> = {
  'duplicate-columns': [
    {
      label: 'duplicates column x as x_copy',
      state: { dataframe: 'df1', sourceColumn: 'x', newColumnName: 'x_copy' },
      expect: { notNull: true, contains: ['mutate', 'x_copy', 'df1'] },
    },
    {
      label: 'returns null without sourceColumn',
      state: { dataframe: 'df1', newColumnName: 'x_copy' },
      expect: { notNull: false },
    },
    {
      label: 'returns null without dataframe',
      state: { sourceColumn: 'x', newColumnName: 'x_copy' },
      expect: { notNull: false },
    },
  ],
  'permute-column': [
    {
      label: 'permutes column height',
      state: { dataframe: 'df1', column: 'height' },
      expect: { notNull: true, contains: ['mutate', 'sample', 'height', 'df1'] },
    },
    {
      label: 'returns null without column',
      state: { dataframe: 'df1' },
      expect: { notNull: false },
    },
  ],
  'delete-columns': [
    {
      label: 'deletes single column',
      state: { dataframe: 'df1', columns: ['age'] },
      expect: { notNull: true, contains: ['select', '-age', 'df1'] },
    },
    {
      label: 'deletes multiple columns',
      state: { dataframe: 'df1', columns: ['age', 'name'] },
      expect: { notNull: true, contains: ['select', '-age', '-name'] },
    },
    {
      label: 'returns null without columns',
      state: { dataframe: 'df1', columns: [] },
      expect: { notNull: false },
    },
  ],
  'insert-column': [
    {
      label: 'inserts numeric column at end',
      state: { dataframe: 'df1', columnName: 'new_col', columnType: 'numeric', position: 'last' },
      expect: { notNull: true, contains: ['add_column', 'new_col', 'NA_real_', 'df1'] },
    },
    {
      label: 'inserts character column at start',
      state: { dataframe: 'df1', columnName: 'label', columnType: 'character', position: 'first' },
      expect: { notNull: true, contains: ['add_column', 'label', 'NA_character_', '.before'] },
    },
    {
      label: 'inserts after specific column',
      state: { dataframe: 'df1', columnName: 'new_col', columnType: 'logical', position: 'after', afterColumn: 'age' },
      expect: { notNull: true, contains: ['add_column', 'new_col', '.after', 'age'] },
    },
    {
      label: 'returns null without columnName',
      state: { dataframe: 'df1', columnType: 'numeric', position: 'last' },
      expect: { notNull: false },
    },
  ],
};

describe('generic dialog parity (Layer 2)', () => {
  for (const [dialogId, fixtures] of Object.entries(FIXTURES)) {
    describe(dialogId, () => {
      for (const fixture of fixtures) {
        it(fixture.label, () => {
          const result = compileStepToR(dialogId, fixture.state);

          if (fixture.expect.notNull) {
            expect(result).not.toBeNull();
            for (const substr of fixture.expect.contains ?? []) {
              expect(result).withContext(`should contain "${substr}"`).toContain(substr);
            }
            for (const substr of fixture.expect.notContains ?? []) {
              expect(result).withContext(`should not contain "${substr}"`).not.toContain(substr);
            }
          } else {
            expect(result).toBeNull();
          }
        });
      }
    });
  }
});
