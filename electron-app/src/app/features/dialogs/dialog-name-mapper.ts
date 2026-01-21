/**
 * Dialog Name Mapper
 * 
 * Maps component type names to dialog IDs for restoration.
 */

/**
 * Map component type name to dialog ID
 */
export function mapComponentTypeToDialogId(componentType: string): string | null {
  // Strip leading underscore if present (Angular may add it in some cases)
  const normalizedType = componentType.startsWith('_') ? componentType.slice(1) : componentType;
  
  const mapping: Record<string, string> = {
    // Climatic dialogs
    'ClimaticSummaryDialogComponent': 'climatic-summary',
    'InventoryPlotDialogComponent': 'inventory-plot',
    'AnnualRainfallDialogComponent': 'annual-rainfall',
    'ExtremesDialogComponent': 'extremes',
    'DayCountDialogComponent': 'day-count',
    'SpellLengthsDialogComponent': 'spell-lengths',
    'SeasonalSummaryDialogComponent': 'seasonal-summary',
    'MissingReportDialogComponent': 'missing-report',
    'TemperatureSummaryDialogComponent': 'temperature-summary',
    'DefineClimaticDataDialogComponent': 'define-climatic-data',
    
    // Statistical dialogs
    'SummaryDialogComponent': 'summary',
    'CorrelationDialogComponent': 'correlation',
    'TTestDialogComponent': 't-test',
    'RegressionDialogComponent': 'regression',
    'DescribeDialogComponent': 'describe',
    
    // Plot dialogs
    'HistogramDialogComponent': 'histogram',
    'BoxplotDialogComponent': 'boxplot',
    'ScatterDialogComponent': 'scatter',
    'BarChartDialogComponent': 'bar-chart',
    'LinePlotDialogComponent': 'line-plot',
    'DotPlotDialogComponent': 'dot-plot',
    
    // Data manipulation dialogs
    'FilterDialogComponent': 'filter',
    'SortDialogComponent': 'sort',
    'CalculateDialogComponent': 'calculate',
    'RecodeDialogComponent': 'recode',
    'RenameDialogComponent': 'rename',
    'MergeDialogComponent': 'merge',
    'StackDialogComponent': 'stack',
    'UnstackDialogComponent': 'unstack',
    
    // Other dialogs
    'ImportDialogComponent': 'import',
    'ExportDialogComponent': 'export',
    'DomainSelectorComponent': 'domain-selector',
  };
  
  return mapping[normalizedType] || null;
}
