/**
 * Describe Dialog Module Exports
 * 
 * Central export point for all describe dialog functionality.
 */

// Main component
export { DescribeDialogComponent } from './describe-dialog.component';

// Service
export { DescribeDialogService, OutputMode } from './describe-dialog.service';

// Panels
export { SummaryPanelComponent } from './panels/summary-panel.component';
export { GraphPanelComponent } from './panels/graph-panel.component';
export { FrequencyPanelComponent } from './panels/frequency-panel.component';

// Utilities
export {
  VariableType,
  VariableCombination,
  GraphType,
  GraphConfig,
  VariableAnalysis,
  GRAPH_CONFIGS,
  analyzeVariables,
  normalizeType,
  determineCombination,
  getRecommendedGraphs,
  getDefaultGraph,
  getGraphConfigsForAnalysis,
} from './utils/variable-type-analyzer';

export {
  SummaryStatistic,
  SummaryMode,
  FrequencyDisplay,
  GraphOptions,
  SummaryOptions,
  FrequencyOptions,
  DescribeOptions,
  buildGraphCode,
  buildSummaryCode,
  buildFrequencyCode,
} from './utils/r-code-builders';
