/**
 * Statistical Analysis Builders
 *
 * Composable framework for generating R code for statistical analyses.
 * These builders may produce multiple outputs (summary, anova, plots) using
 * RSyntax's addBefore() and addAfter() capabilities.
 *
 * Analyses:
 * - Regression: Linear regression with optional summary/anova/plots
 * - Correlation: Correlation matrix with optional p-values
 * - T-Test: One-sample, two-sample, or paired t-test
 */

import { RSyntax, rSyntax, rFn, rStr, rDf, rAssign, rOp, rPipe, toScript, RCode } from '../../r-codegen';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Regression Options
 *
 * Linear regression analysis with optional outputs.
 */
export interface RegressionOptions {
  /** Dataframe name */
  dataframe: string;
  /** Response variable (dependent variable) */
  responseVar: string;
  /** Predictor variables (independent variables) */
  predictorVars: string[];
  /** Model name for assignment (optional) */
  modelName?: string;
  /** Whether to show model summary */
  showSummary?: boolean;
  /** Whether to show ANOVA table */
  showAnova?: boolean;
  /** Whether to plot diagnostics */
  plotDiagnostics?: boolean;
}

/**
 * Correlation Options
 *
 * Correlation analysis between multiple variables.
 */
export interface CorrelationOptions {
  /** Dataframe name */
  dataframe: string;
  /** Selected variables for correlation */
  selectedVars: string[];
  /** Correlation method: 'pearson', 'spearman', 'kendall' */
  method?: 'pearson' | 'spearman' | 'kendall';
  /** Whether to show p-values */
  showPValues?: boolean;
}

/**
 * T-Test Options
 *
 * T-test analysis with discriminated union for different test types.
 */
export interface TTestOptionsBase {
  /** Dataframe name */
  dataframe: string;
  /** Alternative hypothesis: 'two.sided', 'less', 'greater' */
  alternative?: 'two.sided' | 'less' | 'greater';
  /** Confidence level (0-1) */
  confLevel?: string;
}

export interface OneSampleTTestOptions extends TTestOptionsBase {
  testType: 'one';
  /** Variable to test */
  variable1: string;
  /** Hypothesized mean */
  mu: string;
}

export interface TwoSampleTTestOptions extends TTestOptionsBase {
  testType: 'two';
  /** Variable to test */
  variable1: string;
  /** Grouping variable */
  groupVar: string;
}

export interface PairedTTestOptions extends TTestOptionsBase {
  testType: 'paired';
  /** First variable */
  variable1: string;
  /** Second variable */
  variable2: string;
}

export type TTestOptions = OneSampleTTestOptions | TwoSampleTTestOptions | PairedTTestOptions;

// ============================================================================
// Individual Builders
// ============================================================================

/**
 * Build R code for linear regression
 *
 * Creates a linear model and optionally shows summary, ANOVA, and diagnostic plots.
 *
 * @param options - Regression configuration
 * @returns RSyntax instance with R code
 */
export function buildRegression(options: RegressionOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.responseVar) {
    return rSyntax().setBase('# Select a response variable');
  }

  if (options.predictorVars.length === 0) {
    return rSyntax().setBase('# Select at least one predictor variable');
  }

  const modelName = options.modelName || 'model';
  
  // Build formula using rOp for ~ and + operators
  const predictors = options.predictorVars.reduce<RCode | string>((acc, pred, idx) => {
    if (idx === 0) return pred;
    const accCode: RCode | string = acc;
    return rOp('+', accCode, pred);
  }, '' as RCode | string);
  
  const formula = rOp('~', options.responseVar, predictors);
  const formulaStr = toScript(formula);

  // Base: create the model using rFn and rOp for assignment
  const lmCall = rFn('lm', {
    formula: formulaStr,
    data: rDf(options.dataframe),
  });
  const assignment = rOp('<-', modelName, lmCall, { spaceAround: false });
  const baseCode = `# Linear Regression\n${toScript(assignment)}`;

  let syntax = rSyntax().setBase(baseCode);

  // Add summary if requested
  if (options.showSummary) {
    const summaryCall = rFn('summary', { x: modelName });
    syntax = syntax.addAfter(`# Model Summary\n${toScript(summaryCall)}`);
  }

  // Add ANOVA if requested
  if (options.showAnova) {
    const anovaCall = rFn('anova', { object: modelName });
    syntax = syntax.addAfter(`# ANOVA Table\n${toScript(anovaCall)}`);
  }

  // Add diagnostic plots if requested
  if (options.plotDiagnostics) {
    const par1 = rFn('par', { mfrow: 'c(2, 2)' });
    const plotCall = rFn('plot', { x: modelName });
    const par2 = rFn('par', { mfrow: 'c(1, 1)' });
    syntax = syntax.addAfter(`# Diagnostic Plots
${toScript(par1)}
${toScript(plotCall)}
${toScript(par2)}`);
  }

  // Set assignment if model name is provided
  if (options.modelName) {
    syntax = syntax.setAssignment(
      rAssign('model', options.modelName, {
        format: 'text',
      })
    );
  }

  return syntax;
}

/**
 * Build R code for correlation analysis
 *
 * Computes correlation matrix and optionally p-values.
 *
 * @param options - Correlation configuration
 * @returns RSyntax instance with R code
 */
export function buildCorrelation(options: CorrelationOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (options.selectedVars.length < 2) {
    return rSyntax().setBase('# Select at least 2 variables');
  }

  const method = options.method || 'pearson';
  
  // Build select - dplyr::select takes column names as arguments
  // We'll build the select call with column names
  const selectArgs = options.selectedVars.map(v => v).join(', ');
  const selectCall = `dplyr::select(${selectArgs})`;
  
  // Build pipeline using rPipe
  const pipeline = rPipe(
    rDf(options.dataframe),
    selectCall
  );
  
  // Build assignment and correlation calls using rOp and rFn
  const corDataAssign = rOp('<-', 'cor_data', pipeline, { spaceAround: false });
  const corCall = rFn('cor', {
    x: 'cor_data',
    use: rStr('pairwise.complete.obs'),
    method: rStr(method),
  });
  const corMatrixAssign = rOp('<-', 'cor_matrix', corCall, { spaceAround: false });
  const printCall = rFn('print', { x: 'round(cor_matrix, 3)' });

  let baseCode = `# Correlation matrix
${toScript(corDataAssign)}
${toScript(corMatrixAssign)}
${toScript(printCall)}`;

  // Add p-values if requested - complex loops use string format
  if (options.showPValues) {
    const corTestCall = rFn('cor.test', {
      x: 'cor_data[[i]]',
      y: 'cor_data[[j]]',
      method: rStr(method),
    });
    
    baseCode += `

# P-values using cor.test
cat(${rStr('\\nP-values:\\n')})
n <- ncol(cor_data)
p_matrix <- matrix(NA, n, n)
colnames(p_matrix) <- rownames(p_matrix) <- names(cor_data)
for (i in 1:(n-1)) {
  for (j in (i+1):n) {
    test <- ${toScript(corTestCall)}
    p_matrix[i,j] <- p_matrix[j,i] <- test$p.value
  }
}
print(round(p_matrix, 4))`;
  }

  return rSyntax().setBase(baseCode);
}

/**
 * Build R code for t-test
 *
 * Performs one-sample, two-sample, or paired t-test based on test type.
 *
 * @param options - T-test configuration (discriminated union)
 * @returns RSyntax instance with R code
 */
export function buildTTest(options: TTestOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.variable1) {
    return rSyntax().setBase('# Select the test variable');
  }

  const alternative = options.alternative || 'two.sided';
  const confLevel = options.confLevel || '0.95';

  switch (options.testType) {
    case 'one': {
      if (!options.mu) {
        return rSyntax().setBase('# Enter hypothesized mean (mu)');
      }

      // Build column access using rOp for $
      const colAccess = rOp('$', rDf(options.dataframe), options.variable1, { spaceAround: false });
      const colAccessStr = toScript(colAccess);
      
      // Build t.test call using rFn
      const tTestCall = rFn('t.test', {
        x: colAccessStr,
        mu: options.mu,
        alternative: rStr(alternative),
        'conf.level': confLevel,
      });

      return rSyntax().setBase(`# One Sample t-test\n${toScript(tTestCall)}`);
    }

    case 'two': {
      if (!options.groupVar) {
        return rSyntax().setBase('# Select a grouping variable');
      }

      // Build formula using rOp for ~
      const formula = rOp('~', options.variable1, options.groupVar);
      const formulaStr = toScript(formula);
      
      // Build t.test call using rFn
      const tTestCall = rFn('t.test', {
        formula: formulaStr,
        data: rDf(options.dataframe),
        alternative: rStr(alternative),
        'conf.level': confLevel,
      });

      return rSyntax().setBase(`# Two Sample t-test\n${toScript(tTestCall)}`);
    }

    case 'paired': {
      if (!options.variable2) {
        return rSyntax().setBase('# Select a second variable for paired test');
      }

      // Build column accesses using rOp for $
      const colAccess1 = rOp('$', rDf(options.dataframe), options.variable1, { spaceAround: false });
      const colAccess2 = rOp('$', rDf(options.dataframe), options.variable2, { spaceAround: false });
      const colAccess1Str = toScript(colAccess1);
      const colAccess2Str = toScript(colAccess2);
      
      // Build t.test call using rFn
      const tTestCall = rFn('t.test', {
        x: colAccess1Str,
        y: colAccess2Str,
        paired: 'TRUE',
        alternative: rStr(alternative),
        'conf.level': confLevel,
      });

      return rSyntax().setBase(`# Paired t-test\n${toScript(tTestCall)}`);
    }
  }
}

// ============================================================================
// Builder Registry Registrations
// ============================================================================

import { registerBuilder } from './builder-registry';

function str(s: unknown): string {
  return s !== undefined && s !== null ? String(s) : '';
}

registerBuilder('correlation', (state) => {
  const df = str(state['dataframe']).trim();
  const selectedVars = Array.isArray(state['selectedVars']) ? (state['selectedVars'] as string[]).map(String).filter(Boolean) : [];
  const method = (str(state['method']) || 'pearson') as 'pearson' | 'spearman' | 'kendall';
  return buildCorrelation({ dataframe: df, selectedVars, method, showPValues: state['showPValues'] === true });
});

registerBuilder('regression', (state) => {
  const df = str(state['dataframe']).trim();
  const predictorVars = Array.isArray(state['predictorVars']) ? (state['predictorVars'] as string[]).map(String).filter(Boolean) : [];
  return buildRegression({
    dataframe: df,
    responseVar: str(state['responseVar']).trim(),
    predictorVars,
    modelName: str(state['modelName']).trim() || undefined,
    showSummary: state['showSummary'] === true,
    showAnova: state['showAnova'] === true,
    plotDiagnostics: state['plotDiagnostics'] === true,
  });
});

registerBuilder('t-test', (state) => {
  const df = str(state['dataframe']).trim();
  const testType = (str(state['testType']) || 'one') as 'one' | 'two' | 'paired';
  const variable1 = str(state['variable1']).trim();
  const alternative = (str(state['alternative']) || 'two.sided') as 'two.sided' | 'less' | 'greater';
  const confLevel = str(state['confLevel']) || '0.95';
  if (testType === 'two') {
    return buildTTest({ dataframe: df, testType: 'two', variable1, groupVar: str(state['groupVar']).trim(), alternative, confLevel });
  } else if (testType === 'paired') {
    return buildTTest({ dataframe: df, testType: 'paired', variable1, variable2: str(state['variable2']).trim(), alternative, confLevel });
  }
  return buildTTest({ dataframe: df, testType: 'one', variable1, mu: str(state['mu']).trim() || '0', alternative, confLevel });
});
