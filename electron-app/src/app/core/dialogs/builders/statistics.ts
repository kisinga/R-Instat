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

import { RSyntax, rSyntax, rFn, rStr, rDf, rAssign } from '../../r-codegen';

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
  const formula = `${options.responseVar} ~ ${options.predictorVars.join(' + ')}`;

  // Base: create the model
  const baseCode = `# Linear Regression
${modelName} <- lm(${formula}, data = ${rDf(options.dataframe)})`;

  let syntax = rSyntax().setBase(baseCode);

  // Add summary if requested
  if (options.showSummary) {
    syntax = syntax.addAfter(`# Model Summary\nsummary(${modelName})`);
  }

  // Add ANOVA if requested
  if (options.showAnova) {
    syntax = syntax.addAfter(`# ANOVA Table\nanova(${modelName})`);
  }

  // Add diagnostic plots if requested
  if (options.plotDiagnostics) {
    syntax = syntax.addAfter(`# Diagnostic Plots
par(mfrow = c(2, 2))
plot(${modelName})
par(mfrow = c(1, 1))`);
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
  const varsStr = options.selectedVars.map(v => rStr(v)).join(', ');

  // Base: select data and compute correlation
  let baseCode = `# Correlation matrix
cor_data <- ${rDf(options.dataframe)} %>%
  dplyr::select(${varsStr})

cor_matrix <- cor(cor_data, use = "pairwise.complete.obs", method = ${rStr(method)})
print(round(cor_matrix, 3))`;

  // Add p-values if requested
  if (options.showPValues) {
    baseCode += `

# P-values using cor.test
cat("\\nP-values:\\n")
n <- ncol(cor_data)
p_matrix <- matrix(NA, n, n)
colnames(p_matrix) <- rownames(p_matrix) <- names(cor_data)
for (i in 1:(n-1)) {
  for (j in (i+1):n) {
    test <- cor.test(cor_data[[i]], cor_data[[j]], method = ${rStr(method)})
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

      const code = `# One Sample t-test
t.test(
  ${rDf(options.dataframe)}$${options.variable1},
  mu = ${options.mu},
  alternative = ${rStr(alternative)},
  conf.level = ${confLevel}
)`;

      return rSyntax().setBase(code);
    }

    case 'two': {
      if (!options.groupVar) {
        return rSyntax().setBase('# Select a grouping variable');
      }

      const code = `# Two Sample t-test
t.test(
  ${options.variable1} ~ ${options.groupVar},
  data = ${rDf(options.dataframe)},
  alternative = ${rStr(alternative)},
  conf.level = ${confLevel}
)`;

      return rSyntax().setBase(code);
    }

    case 'paired': {
      if (!options.variable2) {
        return rSyntax().setBase('# Select a second variable for paired test');
      }

      const code = `# Paired t-test
t.test(
  ${rDf(options.dataframe)}$${options.variable1},
  ${rDf(options.dataframe)}$${options.variable2},
  paired = TRUE,
  alternative = ${rStr(alternative)},
  conf.level = ${confLevel}
)`;

      return rSyntax().setBase(code);
    }
  }
}
