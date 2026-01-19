/**
 * R Code Generation Tests
 *
 * Unit tests for the core r-codegen module.
 */

import {
  rStr,
  rBool,
  rNum,
  rNull,
  rNA,
  rVec,
  rDf,
  rCol,
  rParams,
  rFn,
  rPipe,
  rPlus,
  rAnd,
  rOr,
  rIf,
  rWrap,
} from './index';

// ============================================================================
// Primitive Tests
// ============================================================================

describe('primitives', () => {
  describe('rStr', () => {
    it('wraps string in double quotes', () => {
      expect(rStr('hello')).toBe('"hello"');
    });

    it('escapes double quotes', () => {
      expect(rStr('say "hello"')).toBe('"say \\"hello\\""');
    });

    it('handles empty string', () => {
      expect(rStr('')).toBe('""');
    });

    it('handles string with special characters', () => {
      expect(rStr("it's fine")).toBe('"it\'s fine"');
    });
  });

  describe('rBool', () => {
    it('returns TRUE for true', () => {
      expect(rBool(true)).toBe('TRUE');
    });

    it('returns FALSE for false', () => {
      expect(rBool(false)).toBe('FALSE');
    });
  });

  describe('rNum', () => {
    it('converts integer', () => {
      expect(rNum(42)).toBe('42');
    });

    it('converts decimal', () => {
      expect(rNum(3.14)).toBe('3.14');
    });

    it('converts negative', () => {
      expect(rNum(-5)).toBe('-5');
    });

    it('converts zero', () => {
      expect(rNum(0)).toBe('0');
    });
  });

  describe('rNull and rNA', () => {
    it('rNull returns NULL', () => {
      expect(rNull()).toBe('NULL');
    });

    it('rNA returns NA', () => {
      expect(rNA()).toBe('NA');
    });
  });

  describe('rVec', () => {
    it('returns single item without c()', () => {
      expect(rVec(['a'])).toBe('"a"');
    });

    it('wraps multiple items in c()', () => {
      expect(rVec(['a', 'b'])).toBe('c("a", "b")');
    });

    it('handles three items', () => {
      expect(rVec(['a', 'b', 'c'])).toBe('c("a", "b", "c")');
    });

    it('returns c() for empty array', () => {
      expect(rVec([])).toBe('c()');
    });

    it('skips quoting when quote=false', () => {
      expect(rVec(['x', 'y'], false)).toBe('c(x, y)');
    });

    it('single item without quote', () => {
      expect(rVec(['x'], false)).toBe('x');
    });
  });

  describe('rDf', () => {
    it('builds get_dataframe call', () => {
      expect(rDf('mydata')).toBe('get_dataframe("mydata")');
    });

    it('escapes quotes in name', () => {
      expect(rDf('my"data')).toBe('get_dataframe("my\\"data")');
    });
  });

  describe('rCol', () => {
    it('builds column accessor', () => {
      expect(rCol('df', 'col')).toBe('get_dataframe("df")$col');
    });
  });

  describe('rParams', () => {
    it('builds single param', () => {
      expect(rParams({ x: 'col' })).toBe('x = col');
    });

    it('builds multiple params', () => {
      expect(rParams({ x: 'col', y: 'row' })).toBe('x = col, y = row');
    });

    it('handles boolean true', () => {
      expect(rParams({ 'na.rm': true })).toBe('na.rm = TRUE');
    });

    it('handles boolean false', () => {
      expect(rParams({ 'na.rm': false })).toBe('na.rm = FALSE');
    });

    it('handles number', () => {
      expect(rParams({ bins: 30 })).toBe('bins = 30');
    });

    it('filters undefined values', () => {
      expect(rParams({ a: 1, b: undefined, c: 'x' })).toBe('a = 1, c = x');
    });

    it('handles empty object', () => {
      expect(rParams({})).toBe('');
    });

    it('handles mixed types', () => {
      expect(rParams({ x: 'col', n: 10, rm: true })).toBe('x = col, n = 10, rm = TRUE');
    });
  });
});

// ============================================================================
// Composition Tests
// ============================================================================

describe('compose', () => {
  describe('rFn', () => {
    it('builds empty function call', () => {
      expect(rFn('n')).toBe('n()');
    });

    it('builds function with params', () => {
      expect(rFn('mean', { x: 'col' })).toBe('mean(x = col)');
    });

    it('builds function with multiple params', () => {
      expect(rFn('mean', { x: 'col', 'na.rm': true })).toBe('mean(x = col, na.rm = TRUE)');
    });

    it('adds package prefix', () => {
      expect(rFn('summarise', { n: 'n()' }, 'dplyr')).toBe('dplyr::summarise(n = n())');
    });

    it('handles package prefix with no params', () => {
      expect(rFn('n', undefined, 'dplyr')).toBe('dplyr::n()');
    });
  });

  describe('rPipe', () => {
    it('joins two expressions', () => {
      expect(rPipe('df', 'filter(x > 0)')).toBe('df %>%\n  filter(x > 0)');
    });

    it('joins three expressions', () => {
      expect(rPipe('df', 'mutate(x = 1)', 'filter(y > 0)')).toBe(
        'df %>%\n  mutate(x = 1) %>%\n  filter(y > 0)'
      );
    });

    it('filters undefined values', () => {
      expect(rPipe('df', undefined, 'filter(x)')).toBe('df %>%\n  filter(x)');
    });

    it('filters false values', () => {
      expect(rPipe('df', false, 'filter(x)')).toBe('df %>%\n  filter(x)');
    });

    it('filters null values', () => {
      expect(rPipe('df', null, 'filter(x)')).toBe('df %>%\n  filter(x)');
    });

    it('handles single expression', () => {
      expect(rPipe('df')).toBe('df');
    });
  });

  describe('rPlus', () => {
    it('joins ggplot layers', () => {
      expect(rPlus('ggplot(df)', 'geom_point()')).toBe('ggplot(df) +\n  geom_point()');
    });

    it('joins multiple layers', () => {
      expect(rPlus('ggplot(df)', 'geom_point()', 'theme_minimal()')).toBe(
        'ggplot(df) +\n  geom_point() +\n  theme_minimal()'
      );
    });

    it('filters undefined', () => {
      expect(rPlus('ggplot(df)', undefined, 'geom_point()')).toBe(
        'ggplot(df) +\n  geom_point()'
      );
    });
  });

  describe('rAnd', () => {
    it('joins with & and wraps in parens', () => {
      expect(rAnd('x > 0', 'y < 10')).toBe('(x > 0) & (y < 10)');
    });

    it('returns single expression without parens', () => {
      expect(rAnd('x > 0')).toBe('x > 0');
    });

    it('handles three conditions', () => {
      expect(rAnd('a', 'b', 'c')).toBe('(a) & (b) & (c)');
    });

    it('filters undefined', () => {
      expect(rAnd('x > 0', undefined, 'y < 10')).toBe('(x > 0) & (y < 10)');
    });

    it('returns empty string for no conditions', () => {
      expect(rAnd()).toBe('');
    });
  });

  describe('rOr', () => {
    it('joins with | and wraps in parens', () => {
      expect(rOr('x == 1', 'x == 2')).toBe('(x == 1) | (x == 2)');
    });

    it('returns single expression without parens', () => {
      expect(rOr('x == 1')).toBe('x == 1');
    });

    it('filters false', () => {
      expect(rOr('x == 1', false, 'x == 2')).toBe('(x == 1) | (x == 2)');
    });
  });

  describe('rIf', () => {
    it('returns expression when true', () => {
      expect(rIf(true, 'filter(x)')).toBe('filter(x)');
    });

    it('returns undefined when false', () => {
      expect(rIf(false, 'filter(x)')).toBeUndefined();
    });

    it('works with rPipe to create conditional steps', () => {
      const hasFilter = true;
      const result = rPipe('df', rIf(hasFilter, 'filter(x > 0)'), 'summarise(n = n())');
      expect(result).toBe('df %>%\n  filter(x > 0) %>%\n  summarise(n = n())');
    });

    it('omits step when condition is false', () => {
      const hasFilter = false;
      const result = rPipe('df', rIf(hasFilter, 'filter(x > 0)'), 'summarise(n = n())');
      expect(result).toBe('df %>%\n  summarise(n = n())');
    });
  });

  describe('rWrap', () => {
    it('wraps in parens by default', () => {
      expect(rWrap('x + y')).toBe('(x + y)');
    });

    it('wraps when condition is true', () => {
      expect(rWrap('x + y', true)).toBe('(x + y)');
    });

    it('does not wrap when condition is false', () => {
      expect(rWrap('x + y', false)).toBe('x + y');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('integration', () => {
  it('builds a dplyr pipeline', () => {
    const code = rPipe(
      rDf('mydata'),
      rFn('mutate', { year: 'year(date)' }),
      rFn('filter', { year: '> 2020' }),
      rFn('summarise', { n: 'n()', mean_x: 'mean(x, na.rm = TRUE)' })
    );

    expect(code).toBe(
      'get_dataframe("mydata") %>%\n' +
        '  mutate(year = year(date)) %>%\n' +
        '  filter(year = > 2020) %>%\n' +
        '  summarise(n = n(), mean_x = mean(x, na.rm = TRUE))'
    );
  });

  it('builds a ggplot', () => {
    const code = rPlus(
      `ggplot(${rDf('df')}, aes(x = col))`,
      rFn('geom_histogram', { bins: 30, alpha: 0.8 }),
      'theme_minimal()',
      rFn('labs', { title: rStr('My Histogram') })
    );

    expect(code).toBe(
      'ggplot(get_dataframe("df"), aes(x = col)) +\n' +
        '  geom_histogram(bins = 30, alpha = 0.8) +\n' +
        '  theme_minimal() +\n' +
        '  labs(title = "My Histogram")'
    );
  });

  it('builds conditional filter expression', () => {
    const hasStation = true;
    const hasYear = true;

    const conditions = [
      rIf(hasStation, 'station == "A"'),
      rIf(hasYear, 'year >= 2020'),
    ].filter(Boolean) as string[];

    const filterExpr = rAnd(...conditions);
    expect(filterExpr).toBe('(station == "A") & (year >= 2020)');
  });
});
