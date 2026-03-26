import { interpolateRCode } from './r-code-interpolator';
import { p } from '../dialog-schema.registry';

describe('R Code Interpolator', () => {
  it('substitutes dataframe as bare name', () => {
    const params = [p('df', 'dataframe')];
    expect(interpolateRCode('summary({{df}})', { df: 'mydata' }, params))
      .toBe('summary(mydata)');
  });

  it('substitutes number as bare value', () => {
    const params = [p('bins', 'number')];
    expect(interpolateRCode('bins = {{bins}}', { bins: 30 }, params))
      .toBe('bins = 30');
  });

  it('substitutes boolean as TRUE/FALSE', () => {
    const params = [p('naRm', 'boolean')];
    expect(interpolateRCode('na.rm = {{naRm}}', { naRm: true }, params))
      .toBe('na.rm = TRUE');
    expect(interpolateRCode('na.rm = {{naRm}}', { naRm: false }, params))
      .toBe('na.rm = FALSE');
  });

  it('substitutes column/string/enum as bare (author adds quotes)', () => {
    const params = [p('col', 'column'), p('method', 'enum')];
    expect(interpolateRCode('df${{col}}', { col: 'age' }, params))
      .toBe('df$age');
    expect(interpolateRCode('method = "{{method}}"', { method: 'pearson' }, params))
      .toBe('method = "pearson"');
  });

  it('substitutes column[] as quoted comma-separated (for c())', () => {
    const params = [p('cols', 'column[]')];
    expect(interpolateRCode('c({{cols}})', { cols: ['x', 'y', 'z'] }, params))
      .toBe('c("x", "y", "z")');
  });

  it('substitutes string[] as quoted comma-separated', () => {
    const params = [p('items', 'string[]')];
    expect(interpolateRCode('c({{items}})', { items: ['a', 'b'] }, params))
      .toBe('c("a", "b")');
  });

  it('handles df$col pattern correctly (no quotes on column)', () => {
    const params = [p('df', 'dataframe'), p('col', 'column')];
    expect(interpolateRCode('{{df}}${{col}}', { df: 'mydata', col: 'age' }, params))
      .toBe('mydata$age');
  });

  it('returns null for empty rCode', () => {
    expect(interpolateRCode('', {}, [])).toBeNull();
  });

  it('returns null for whitespace-only result', () => {
    expect(interpolateRCode('  ', {}, [])).toBeNull();
  });

  it('returns empty string for missing param value', () => {
    const params = [p('x', 'number')];
    expect(interpolateRCode('val = {{x}}', {}, params)).toBe('val =');
  });

  it('chi-square example', () => {
    const params = [
      p('dataframe', 'dataframe'),
      p('col1', 'column'),
      p('col2', 'column'),
      p('correct', 'boolean'),
      p('simulate', 'boolean'),
    ];
    const rCode = 'chisq.test(table({{dataframe}}${{col1}}, {{dataframe}}${{col2}}), correct = {{correct}}, simulate.p.value = {{simulate}})';
    expect(interpolateRCode(rCode, {
      dataframe: 'df1', col1: 'sex', col2: 'treatment', correct: true, simulate: false,
    }, params)).toBe(
      'chisq.test(table(df1$sex, df1$treatment), correct = TRUE, simulate.p.value = FALSE)'
    );
  });

  it('correlation example with column[] and enum', () => {
    const params = [
      p('dataframe', 'dataframe'),
      p('selectedVars', 'column[]'),
      p('method', 'enum'),
      p('showPValues', 'boolean'),
    ];
    const rCode = 'cor_data <- dplyr::select(get_dataframe("{{dataframe}}"), {{selectedVars}})\ncor(cor_data, method = "{{method}}")';
    expect(interpolateRCode(rCode, {
      dataframe: 'df1', selectedVars: ['height', 'weight'], method: 'pearson', showPValues: false,
    }, params)).toBe(
      'cor_data <- dplyr::select(get_dataframe("df1"), "height", "weight")\ncor(cor_data, method = "pearson")'
    );
  });
});
