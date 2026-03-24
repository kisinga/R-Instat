import { compileStepToR } from './step-to-r';

describe('step-to-r', () => {
  it('returns null for unknown dialogId', () => {
    expect(compileStepToR('unknown-dialog', { dataframe: 'df1' })).toBeNull();
  });

  it('returns null when dataframe is missing', () => {
    expect(compileStepToR('sort', { sortColumns: [{ column: 'x', descending: false }] })).toBeNull();
  });

  describe('sort', () => {
    it('produces R script for valid state', () => {
      const script = compileStepToR('sort', {
        dataframe: 'df1',
        sortColumns: [{ column: 'a', descending: false }, { column: 'b', descending: true }],
      });
      expect(script).not.toBeNull();
      expect(script).toContain('arrange');
      expect(script).toContain('df1');
    });
    it('returns null when sortColumns is empty', () => {
      expect(compileStepToR('sort', { dataframe: 'df1', sortColumns: [] })).toBeNull();
    });
  });

  describe('rename', () => {
    it('produces R script for valid state', () => {
      const script = compileStepToR('rename', { dataframe: 'df1', oldName: 'old', newName: 'new' });
      expect(script).not.toBeNull();
      expect(script).toContain('rename');
      expect(script).toContain('old');
      expect(script).toContain('new');
    });
    it('returns null when oldName or newName is missing', () => {
      expect(compileStepToR('rename', { dataframe: 'df1', newName: 'new' })).toBeNull();
      expect(compileStepToR('rename', { dataframe: 'df1', oldName: 'old' })).toBeNull();
    });
  });

  describe('calculate', () => {
    it('produces R script for formula calcType', () => {
      const script = compileStepToR('calculate', {
        dataframe: 'df1',
        newColumnName: 'z',
        calcType: 'formula',
        formula: 'x + y',
      });
      expect(script).not.toBeNull();
      expect(script).toContain('mutate');
      expect(script).toContain('z');
    });
    it('returns null when formula missing for calcType formula', () => {
      expect(compileStepToR('calculate', {
        dataframe: 'df1',
        newColumnName: 'z',
        calcType: 'formula',
      })).toBeNull();
    });
  });

  describe('correlation', () => {
    it('produces R script for valid state', () => {
      const script = compileStepToR('correlation', {
        dataframe: 'df1',
        selectedVars: ['a', 'b', 'c'],
        method: 'pearson',
      });
      expect(script).not.toBeNull();
      expect(script).toContain('cor');
      expect(script).toContain('df1');
    });
    it('returns null when fewer than 2 variables', () => {
      expect(compileStepToR('correlation', { dataframe: 'df1', selectedVars: ['a'] })).toBeNull();
    });
  });

  describe('regression', () => {
    it('produces R script for valid state', () => {
      const script = compileStepToR('regression', {
        dataframe: 'df1',
        responseVar: 'y',
        predictorVars: ['x1', 'x2'],
      });
      expect(script).not.toBeNull();
      expect(script).toContain('lm');
      expect(script).toContain('y');
      expect(script).toContain('x1');
    });
    it('returns null when responseVar or predictorVars missing', () => {
      expect(compileStepToR('regression', { dataframe: 'df1', predictorVars: ['x1'] })).toBeNull();
      expect(compileStepToR('regression', { dataframe: 'df1', responseVar: 'y', predictorVars: [] })).toBeNull();
    });
  });

  describe('t-test', () => {
    it('produces R script for one-sample', () => {
      const script = compileStepToR('t-test', {
        dataframe: 'df1',
        testType: 'one',
        variable1: 'x',
        mu: '0',
      });
      expect(script).not.toBeNull();
      expect(script).toContain('t.test');
      expect(script).toContain('x');
    });
    it('produces R script for two-sample', () => {
      const script = compileStepToR('t-test', {
        dataframe: 'df1',
        testType: 'two',
        variable1: 'x',
        groupVar: 'g',
      });
      expect(script).not.toBeNull();
      expect(script).toContain('t.test');
    });
    it('returns null when variable1 missing', () => {
      expect(compileStepToR('t-test', { dataframe: 'df1', testType: 'one', mu: '0' })).toBeNull();
    });
  });

  describe('histogram', () => {
    it('produces R script for valid state', () => {
      const script = compileStepToR('histogram', { dataframe: 'df1', variable: 'x' });
      expect(script).not.toBeNull();
      expect(script).toContain('ggplot');
      expect(script).toContain('geom_histogram');
    });
    it('returns null when variable missing', () => {
      expect(compileStepToR('histogram', { dataframe: 'df1' })).toBeNull();
    });
  });

  describe('boxplot', () => {
    it('produces R script for valid state', () => {
      const script = compileStepToR('boxplot', { dataframe: 'df1', yVariable: 'y', xVariable: 'g' });
      expect(script).not.toBeNull();
      expect(script).toContain('geom_boxplot');
    });
    it('returns null when yVariable missing', () => {
      expect(compileStepToR('boxplot', { dataframe: 'df1' })).toBeNull();
    });
  });

  describe('scatter', () => {
    it('produces R script for valid state', () => {
      const script = compileStepToR('scatter', { dataframe: 'df1', xVariable: 'x', yVariable: 'y' });
      expect(script).not.toBeNull();
      expect(script).toContain('geom_point');
    });
    it('returns null when x or y variable missing', () => {
      expect(compileStepToR('scatter', { dataframe: 'df1', yVariable: 'y' })).toBeNull();
      expect(compileStepToR('scatter', { dataframe: 'df1', xVariable: 'x' })).toBeNull();
    });
  });

  describe('bar-chart', () => {
    it('produces R script for frequency type', () => {
      const script = compileStepToR('bar-chart', { dataframe: 'df1', xVariable: 'cat', chartType: 'frequency' });
      expect(script).not.toBeNull();
      expect(script).toContain('geom_bar');
    });
    it('produces R script for value type when yVariable present', () => {
      const script = compileStepToR('bar-chart', {
        dataframe: 'df1',
        xVariable: 'cat',
        yVariable: 'val',
        chartType: 'value',
      });
      expect(script).not.toBeNull();
      expect(script).toContain('geom_bar');
    });
    it('returns null when xVariable missing', () => {
      expect(compileStepToR('bar-chart', { dataframe: 'df1' })).toBeNull();
    });
  });

  describe('recode', () => {
    it('produces R script for valid state', () => {
      const script = compileStepToR('recode', {
        dataframe: 'df1',
        sourceColumn: 'status',
        mappings: [{ from: 'A', to: 'Active' }, { from: 'I', to: 'Inactive' }],
      });
      expect(script).not.toBeNull();
      expect(script).toContain('case_when');
      expect(script).toContain('status');
    });
    it('returns null when sourceColumn or mappings missing', () => {
      expect(compileStepToR('recode', { dataframe: 'df1', mappings: [{ from: 'A', to: 'B' }] })).toBeNull();
      expect(compileStepToR('recode', { dataframe: 'df1', sourceColumn: 'x', mappings: [] })).toBeNull();
    });
  });
});
