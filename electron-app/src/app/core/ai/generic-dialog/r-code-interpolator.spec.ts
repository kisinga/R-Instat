import { interpolateRCode } from './r-code-interpolator';
import type { DialogParamSchema } from '../dialog-schema.registry';
import { p } from '../dialog-schema.registry';

describe('R Code Interpolator', () => {
  it('substitutes dataframe as bare name', () => {
    const params = [p('df', 'dataframe')];
    expect(interpolateRCode('summary({{df}})', { df: 'mydata' }, params))
      .toBe('summary(mydata)');
  });

  it('substitutes number as bare value', () => {
    const params = [p('df', 'dataframe'), p('bins', 'number')];
    expect(interpolateRCode('hist({{df}}, bins = {{bins}})', { df: 'd', bins: 30 }, params))
      .toBe('hist(d, bins = 30)');
  });

  it('substitutes boolean as TRUE/FALSE', () => {
    const params = [p('naRm', 'boolean')];
    expect(interpolateRCode('mean(x, na.rm = {{naRm}})', { naRm: true }, params))
      .toBe('mean(x, na.rm = TRUE)');
    expect(interpolateRCode('mean(x, na.rm = {{naRm}})', { naRm: false }, params))
      .toBe('mean(x, na.rm = FALSE)');
  });

  it('substitutes string/column/enum as R-quoted', () => {
    const params = [p('col', 'column'), p('method', 'enum')];
    expect(interpolateRCode('cor({{col}}, method = {{method}})', { col: 'age', method: 'pearson' }, params))
      .toBe('cor("age", method = "pearson")');
  });

  it('substitutes column[] as c("a", "b")', () => {
    const params = [p('cols', 'column[]')];
    expect(interpolateRCode('select(df, {{cols}})', { cols: ['x', 'y', 'z'] }, params))
      .toBe('select(df, c("x", "y", "z"))');
  });

  it('substitutes string[] as c("a", "b")', () => {
    const params = [p('items', 'string[]')];
    expect(interpolateRCode('filter({{items}})', { items: ['a', 'b'] }, params))
      .toBe('filter(c("a", "b"))');
  });

  it('handles multiple occurrences of same param', () => {
    const params = [p('df', 'dataframe'), p('col', 'column')];
    expect(interpolateRCode('{{df}}${{col}} <- as.factor({{df}}${{col}})', { df: 'd', col: 'x' }, params))
      .toBe('d$"x" <- as.factor(d$"x")');
  });

  it('returns null for empty rCode', () => {
    expect(interpolateRCode('', {}, [])).toBeNull();
  });

  it('returns null for whitespace-only result', () => {
    expect(interpolateRCode('  ', {}, [])).toBeNull();
  });

  it('returns empty string for missing param value', () => {
    const params = [p('x', 'string')];
    expect(interpolateRCode('val = {{x}}', {}, params)).toBe('val =');
  });

  it('treats unknown param names as string kind', () => {
    expect(interpolateRCode('{{unknown}}', { unknown: 'hello' }, []))
      .toBe('"hello"');
  });

  it('works with a realistic chi-square example', () => {
    const params = [
      p('dataframe', 'dataframe'),
      p('col1', 'column'),
      p('col2', 'column'),
    ];
    const rCode = 'chisq.test(table({{dataframe}}${{col1}}, {{dataframe}}${{col2}}))';
    expect(interpolateRCode(rCode, { dataframe: 'df1', col1: 'sex', col2: 'treatment' }, params))
      .toBe('chisq.test(table(df1$"sex", df1$"treatment"))');
  });
});
