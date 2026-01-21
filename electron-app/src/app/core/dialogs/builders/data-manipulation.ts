/**
 * Data Manipulation Builders
 *
 * Composable framework for generating R code for data manipulation operations.
 * All builders use dplyr operations and return RSyntax with assignment.
 *
 * Operations:
 * - Calculate: Create new column with calculations (mutate)
 * - Rename: Rename columns (rename)
 * - Recode: Recode values using case_when (mutate)
 * - Sort: Sort rows by columns (arrange)
 */

import { RSyntax, rSyntax, rFn, rStr, rPipe, rDf, rAssign } from '../../r-codegen';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Calculate Options
 *
 * Creates a new column with calculated values.
 */
export interface CalculateOptions {
  /** Dataframe name */
  dataframe: string;
  /** New column name */
  newColumnName: string;
  /** Calculation type */
  calcType: 'formula' | 'sum' | 'mean' | 'diff' | 'ratio';
  /** Custom formula (for calcType='formula') */
  formula?: string;
  /** Selected columns (for sum/mean) */
  selectedCols?: string[];
  /** Column A (for diff/ratio) */
  columnA?: string;
  /** Column B (for diff/ratio) */
  columnB?: string;
}

/**
 * Rename Options
 *
 * Renames a column in the dataframe.
 */
export interface RenameOptions {
  /** Dataframe name */
  dataframe: string;
  /** Old column name */
  oldName: string;
  /** New column name */
  newName: string;
}

/**
 * Recode Mapping
 *
 * Maps a value from one value to another.
 */
export interface RecodeMapping {
  /** Source value */
  from: string;
  /** Target value */
  to: string;
}

/**
 * Recode Options
 *
 * Recodes values in a column using case_when.
 */
export interface RecodeOptions {
  /** Dataframe name */
  dataframe: string;
  /** Source column to recode */
  sourceColumn: string;
  /** New column name (optional, defaults to sourceColumn) */
  newColumnName?: string;
  /** Value mappings */
  mappings: RecodeMapping[];
  /** Default value for unmapped values (optional) */
  defaultValue?: string;
}

/**
 * Sort Column
 *
 * Defines a column and sort direction.
 */
export interface SortColumn {
  /** Column name */
  column: string;
  /** Whether to sort descending */
  descending: boolean;
}

/**
 * Sort Options
 *
 * Sorts rows by one or more columns.
 */
export interface SortOptions {
  /** Dataframe name */
  dataframe: string;
  /** Columns to sort by */
  sortColumns: SortColumn[];
}

// ============================================================================
// Shared Helper Functions
// ============================================================================

/**
 * Build dplyr pipeline with assignment
 *
 * Common pattern for data manipulation: mutate/rename/arrange + add_dataframe
 *
 * @param dataframe - Dataframe name
 * @param pipeline - The dplyr pipeline string
 * @param resultVar - Variable name for the result (default: based on operation)
 * @returns RSyntax with assignment
 */
function buildDataManipulationPipeline(
  dataframe: string,
  pipeline: string,
  resultVar: string = 'updated_data'
): RSyntax {
  // Extract the result variable name from pipeline if it contains <-
  const match = pipeline.match(/^(\w+)\s*<-/);
  const varName = match ? match[1] : resultVar;

  const code = `${varName} <- ${pipeline.replace(/^\w+\s*<-\s*/, '')}

add_dataframe(${rStr(dataframe)}, ${varName})`;

  return rSyntax().setBase(code);
}

// ============================================================================
// Individual Builders
// ============================================================================

/**
 * Build R code for calculate (mutate) operation
 *
 * Creates a new column with calculated values based on calculation type.
 *
 * @param options - Calculate configuration
 * @returns RSyntax instance with dplyr code
 */
export function buildCalculate(options: CalculateOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.newColumnName) {
    return rSyntax().setBase('# Enter a new column name');
  }

  // Build expression based on calculation type
  let expression = '';

  switch (options.calcType) {
    case 'formula':
      expression = options.formula || '0';
      break;
    case 'sum':
      if (options.selectedCols && options.selectedCols.length > 0) {
        expression = options.selectedCols.join(' + ');
      } else {
        return rSyntax().setBase('# Select columns to sum');
      }
      break;
    case 'mean':
      if (options.selectedCols && options.selectedCols.length > 0) {
        expression = `(${options.selectedCols.join(' + ')}) / ${options.selectedCols.length}`;
      } else {
        return rSyntax().setBase('# Select columns to average');
      }
      break;
    case 'diff':
      if (options.columnA && options.columnB) {
        expression = `${options.columnA} - ${options.columnB}`;
      } else {
        return rSyntax().setBase('# Select both columns for difference');
      }
      break;
    case 'ratio':
      if (options.columnA && options.columnB) {
        expression = `${options.columnA} / ${options.columnB}`;
      } else {
        return rSyntax().setBase('# Select both columns for ratio');
      }
      break;
  }

  if (!expression) {
    return rSyntax().setBase('# Please specify the calculation');
  }

  // Build dplyr pipeline
  const pipeline = rPipe(
    rDf(options.dataframe),
    `dplyr::mutate(${options.newColumnName} = ${expression})`
  );

  return buildDataManipulationPipeline(options.dataframe, pipeline, 'updated_data');
}

/**
 * Build R code for rename operation
 *
 * Renames a column in the dataframe.
 *
 * @param options - Rename configuration
 * @returns RSyntax instance with dplyr code
 */
export function buildRename(options: RenameOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.oldName || !options.newName) {
    return rSyntax().setBase('# Select column and enter new name');
  }

  // Build dplyr pipeline
  const pipeline = rPipe(
    rDf(options.dataframe),
    `dplyr::rename(${options.newName} = ${options.oldName})`
  );

  return buildDataManipulationPipeline(options.dataframe, pipeline, 'renamed_data');
}

/**
 * Build R code for recode operation
 *
 * Recodes values in a column using case_when.
 *
 * @param options - Recode configuration
 * @returns RSyntax instance with dplyr code
 */
export function buildRecode(options: RecodeOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.sourceColumn) {
    return rSyntax().setBase('# Select a source column');
  }

  const validMappings = options.mappings.filter(m => m.from && m.to);

  if (validMappings.length === 0) {
    return rSyntax().setBase('# Add at least one recode mapping');
  }

  // Build case_when expressions
  const caseWhens = validMappings.map(m => {
    const isFromNumeric = !isNaN(Number(m.from));
    const isToNumeric = !isNaN(Number(m.to));
    const fromVal = isFromNumeric ? m.from : rStr(m.from);
    const toVal = isToNumeric ? m.to : rStr(m.to);
    return `${options.sourceColumn} == ${fromVal} ~ ${toVal}`;
  });

  // Add default
  let defaultExpr = options.sourceColumn; // Keep original
  if (options.defaultValue) {
    const isNumeric = !isNaN(Number(options.defaultValue));
    defaultExpr = isNumeric ? options.defaultValue : rStr(options.defaultValue);
  }
  caseWhens.push(`TRUE ~ ${defaultExpr}`);

  const targetCol = options.newColumnName || options.sourceColumn;
  const caseWhenExpr = `dplyr::case_when(\n      ${caseWhens.join(',\n      ')}\n    )`;

  // Build dplyr pipeline
  const pipeline = `${rDf(options.dataframe)} %>%
  dplyr::mutate(
    ${targetCol} = ${caseWhenExpr}
  )`;

  return buildDataManipulationPipeline(options.dataframe, pipeline, 'recoded_data');
}

/**
 * Build R code for sort (arrange) operation
 *
 * Sorts rows by one or more columns.
 *
 * @param options - Sort configuration
 * @returns RSyntax instance with dplyr code
 */
export function buildSort(options: SortOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  const sortExprs = options.sortColumns
    .filter(s => s.column)
    .map(s => s.descending ? `desc(${s.column})` : s.column);

  if (sortExprs.length === 0) {
    return rSyntax().setBase('# Select columns to sort by');
  }

  // Build dplyr pipeline
  const arrangeArgs = sortExprs.join(', ');
  const pipeline = rPipe(
    rDf(options.dataframe),
    `dplyr::arrange(${arrangeArgs})`
  );

  return buildDataManipulationPipeline(options.dataframe, pipeline, 'sorted_data');
}
