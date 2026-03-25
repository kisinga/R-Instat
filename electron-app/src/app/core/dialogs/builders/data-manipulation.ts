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
 * - DuplicateColumn: Copy a column under a new name (mutate)
 * - PermuteColumn: Randomly shuffle a column's values (mutate + sample)
 * - DeleteColumns: Remove columns from a dataframe (select)
 * - InsertColumn: Add a new empty column (add_column)
 */

import { RSyntax, rSyntax, rFn, rStr, rPipe, rDf, rAssign, rOp, toScript, RCode } from '../../r-codegen';

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

/**
 * Duplicate Column Options
 *
 * Copies a column under a new name.
 */
export interface DuplicateColumnOptions {
  /** Dataframe name */
  dataframe: string;
  /** Source column to duplicate */
  sourceColumn: string;
  /** Name for the new copy */
  newColumnName: string;
}

/**
 * Permute Column Options
 *
 * Randomly shuffles a column's values in place.
 */
export interface PermuteColumnOptions {
  /** Dataframe name */
  dataframe: string;
  /** Column to permute */
  column: string;
}

/**
 * Delete Columns Options
 *
 * Removes one or more columns from a dataframe.
 */
export interface DeleteColumnsOptions {
  /** Dataframe name */
  dataframe: string;
  /** Columns to remove */
  columns: string[];
}

/**
 * Insert Column Options
 *
 * Adds a new empty column to a dataframe.
 */
export interface InsertColumnOptions {
  /** Dataframe name */
  dataframe: string;
  /** Name for the new column */
  columnName: string;
  /** Type of the new column */
  columnType: 'numeric' | 'character' | 'logical';
  /** Position to insert */
  position: 'first' | 'last' | 'after';
  /** Column to insert after (when position='after') */
  afterColumn?: string;
}

// ============================================================================
// Shared Helper Functions
// ============================================================================

/**
 * Build dplyr pipeline with assignment and add_dataframe call
 *
 * Common pattern for data manipulation: mutate/rename/arrange + add_dataframe
 * Uses r-codegen primitives for composability.
 *
 * @param dataframe - Dataframe name
 * @param pipeline - The dplyr pipeline (RCode or string)
 * @param resultVar - Variable name for the result (default: 'updated_data')
 * @returns RSyntax with assignment and add_dataframe call
 */
function buildDataManipulationPipeline(
  dataframe: string,
  pipeline: RCode | string,
  resultVar: string = 'updated_data'
): RSyntax {
  const pipelineStr = typeof pipeline === 'string' ? pipeline : toScript(pipeline);
  
  // Build assignment: resultVar <- pipeline using rOp
  const assignment = rOp('<-', resultVar, pipelineStr, { spaceAround: false });
  const assignmentStr = toScript(assignment);
  
  // Build add_dataframe call using rFn
  const addDataframeCall = rFn('add_dataframe', {
    name: rStr(dataframe),
    df: resultVar,
  });
  
  return rSyntax()
    .setBase(assignmentStr)
    .addAfter(addDataframeCall);
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
  let expression: RCode | string = '';

  switch (options.calcType) {
    case 'formula':
      expression = options.formula || '0';
      break;
    case 'sum':
      if (options.selectedCols && options.selectedCols.length > 0) {
        // Build sum using rOp for each addition
        expression = options.selectedCols.reduce<RCode | string>((acc, col, idx) => {
          if (idx === 0) return col;
          const accCode: RCode | string = acc;
          return rOp('+', accCode, col);
        }, '' as RCode | string);
      } else {
        return rSyntax().setBase('# Select columns to sum');
      }
      break;
    case 'mean':
      if (options.selectedCols && options.selectedCols.length > 0) {
        // Build sum, then divide by count
        const sum = options.selectedCols.reduce<RCode | string>((acc, col, idx) => {
          if (idx === 0) return col;
          const accCode: RCode | string = acc;
          return rOp('+', accCode, col);
        }, '' as RCode | string);
        const sumStr = typeof sum === 'string' ? sum : toScript(sum);
        expression = `(${sumStr}) / ${options.selectedCols.length}`;
      } else {
        return rSyntax().setBase('# Select columns to average');
      }
      break;
    case 'diff':
      if (options.columnA && options.columnB) {
        expression = rOp('-', options.columnA, options.columnB);
      } else {
        return rSyntax().setBase('# Select both columns for difference');
      }
      break;
    case 'ratio':
      if (options.columnA && options.columnB) {
        expression = rOp('/', options.columnA, options.columnB);
      } else {
        return rSyntax().setBase('# Select both columns for ratio');
      }
      break;
  }

  if (!expression) {
    return rSyntax().setBase('# Please specify the calculation');
  }

  // Build dplyr pipeline using rFn
  const expressionStr = typeof expression === 'string' ? expression : toScript(expression);
  const pipeline = rPipe(
    rDf(options.dataframe),
    rFn('mutate', { [options.newColumnName]: expressionStr }, 'dplyr')
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

  // Build dplyr pipeline using rFn
  const pipeline = rPipe(
    rDf(options.dataframe),
    rFn('rename', { [options.newName]: options.oldName }, 'dplyr')
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

  // Build case_when expressions using rOp for equality checks
  const caseWhenConditions: string[] = [];
  for (const m of validMappings) {
    const isFromNumeric = !isNaN(Number(m.from));
    const isToNumeric = !isNaN(Number(m.to));
    const fromVal = isFromNumeric ? m.from : rStr(m.from);
    const toVal = isToNumeric ? m.to : rStr(m.to);
    
    // Build: sourceColumn == fromVal ~ toVal using rOp for equality
    const equality = rOp('==', options.sourceColumn, fromVal);
    const condition = `${toScript(equality)} ~ ${toVal}`;
    caseWhenConditions.push(condition);
  }

  // Add default
  let defaultExpr = options.sourceColumn; // Keep original
  if (options.defaultValue) {
    const isNumeric = !isNaN(Number(options.defaultValue));
    defaultExpr = isNumeric ? options.defaultValue : rStr(options.defaultValue);
  }
  caseWhenConditions.push(`TRUE ~ ${defaultExpr}`);

  // Build case_when call - case_when has special syntax with multiple conditions
  // We build the string representation but use r-codegen for the mutate wrapper
  const targetCol = options.newColumnName || options.sourceColumn;
  const caseWhenStr = `dplyr::case_when(\n      ${caseWhenConditions.join(',\n      ')}\n    )`;

  // Build dplyr pipeline using rFn for mutate
  const pipeline = rPipe(
    rDf(options.dataframe),
    rFn('mutate', { [targetCol]: caseWhenStr }, 'dplyr')
  );

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

  const validColumns = options.sortColumns.filter(s => s.column);
  
  if (validColumns.length === 0) {
    return rSyntax().setBase('# Select columns to sort by');
  }

  // Build arrange arguments - desc() calls for descending, column names for ascending
  // arrange() takes positional arguments, so we build the string representation
  const arrangeArgs = validColumns.map(col => 
    col.descending ? `desc(${col.column})` : col.column
  ).join(', ');

  // Build dplyr pipeline - use rPipe for structure, string for arrange (positional args)
  const arrangeCall = `dplyr::arrange(${arrangeArgs})`;
  const pipeline = rPipe(
    rDf(options.dataframe),
    arrangeCall
  );

  return buildDataManipulationPipeline(options.dataframe, pipeline, 'sorted_data');
}

/**
 * Build R code for duplicating a column
 *
 * Copies a column under a new name using dplyr::mutate.
 *
 * @param options - Duplicate column configuration
 * @returns RSyntax instance with dplyr code
 */
export function buildDuplicateColumn(options: DuplicateColumnOptions): RSyntax {
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }
  if (!options.sourceColumn) {
    return rSyntax().setBase('# Select a column to duplicate');
  }
  if (!options.newColumnName) {
    return rSyntax().setBase('# Enter a name for the new column');
  }

  const pipeline = rPipe(
    rDf(options.dataframe),
    rFn('mutate', { [options.newColumnName]: options.sourceColumn }, 'dplyr')
  );

  return buildDataManipulationPipeline(options.dataframe, pipeline, 'updated_data');
}

/**
 * Build R code for permuting (randomly shuffling) a column
 *
 * Replaces column values with a random permutation using sample().
 *
 * @param options - Permute column configuration
 * @returns RSyntax instance with dplyr code
 */
export function buildPermuteColumn(options: PermuteColumnOptions): RSyntax {
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }
  if (!options.column) {
    return rSyntax().setBase('# Select a column to permute');
  }

  const pipeline = rPipe(
    rDf(options.dataframe),
    rFn('mutate', { [options.column]: `sample(${options.column})` }, 'dplyr')
  );

  return buildDataManipulationPipeline(options.dataframe, pipeline, 'updated_data');
}

/**
 * Build R code for deleting columns
 *
 * Removes one or more columns using dplyr::select with negation.
 *
 * @param options - Delete columns configuration
 * @returns RSyntax instance with dplyr code
 */
export function buildDeleteColumns(options: DeleteColumnsOptions): RSyntax {
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }
  if (!options.columns || options.columns.length === 0) {
    return rSyntax().setBase('# Select columns to delete');
  }

  const negatedCols = options.columns.map(c => `-${c}`).join(', ');
  const selectCall = `dplyr::select(${negatedCols})`;
  const pipeline = rPipe(rDf(options.dataframe), selectCall);

  return buildDataManipulationPipeline(options.dataframe, pipeline, 'updated_data');
}

/**
 * Build R code for inserting a new empty column
 *
 * Adds a column filled with NA of the specified type using tibble::add_column.
 *
 * @param options - Insert column configuration
 * @returns RSyntax instance with dplyr code
 */
export function buildInsertColumn(options: InsertColumnOptions): RSyntax {
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }
  if (!options.columnName) {
    return rSyntax().setBase('# Enter a column name');
  }

  const typeDefault: Record<string, string> = {
    numeric: 'NA_real_',
    character: 'NA_character_',
    logical: 'NA',
  };
  const naValue = typeDefault[options.columnType] ?? 'NA';

  const args: Record<string, string> = {
    '.data': rDf(options.dataframe),
    [options.columnName]: naValue,
  };

  if (options.position === 'first') {
    args['.before'] = '1';
  } else if (options.position === 'after' && options.afterColumn) {
    args['.after'] = options.afterColumn;
  }
  // 'last' is the default — no extra arg needed

  const addColumnCall = rFn('add_column', args, 'tibble');
  const assignment = rOp('<-', 'updated_data', addColumnCall, { spaceAround: false });

  const addDataframeCall = rFn('add_dataframe', {
    name: rStr(options.dataframe),
    df: 'updated_data',
  });

  return rSyntax()
    .setBase(toScript(assignment))
    .addAfter(addDataframeCall);
}
