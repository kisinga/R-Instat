/**
 * Describe Dialog Service
 * 
 * Centralized state management and R code generation for the Describe dialog.
 * Coordinates between variable selection, output type, and R code building.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { RService } from '../../../core/services/r.service';
import { ColumnInfo } from '../../../core/models/r.model';
import {
  analyzeVariables,
  VariableAnalysis,
  GraphType,
  GRAPH_CONFIGS,
  GraphConfig,
} from './utils/variable-type-analyzer';
import {
  buildGraphCode,
  buildSummaryCode,
  buildFrequencyCode,
  GraphOptions,
  SummaryOptions,
  FrequencyOptions,
  SummaryStatistic,
  SummaryMode,
  FrequencyDisplay,
} from './utils/r-code-builders';

/** Output mode for the describe dialog */
export type OutputMode = 'summary' | 'graph' | 'frequency';

/** State of the describe dialog */
export interface DescribeDialogState {
  // Data selection
  dataframe: string;
  selectedColumns: ColumnInfo[];
  
  // Output mode
  outputMode: OutputMode;
  
  // Graph options
  graphType: GraphType | null;
  graphOptions: Partial<GraphOptions>;
  
  // Summary options
  summaryMode: SummaryMode;
  summaryStatistics: SummaryStatistic[];
  omitMissing: boolean;
  groupBy: string;
  
  // Frequency options
  frequencyDisplay: FrequencyDisplay;
  showCount: boolean;
  showRowPercent: boolean;
  showColPercent: boolean;
  weights: string;
}

/** Default state */
const DEFAULT_STATE: DescribeDialogState = {
  dataframe: '',
  selectedColumns: [],
  outputMode: 'graph',
  graphType: null,
  graphOptions: {
    flipCoords: false,
    alpha: 0.8,
    bins: 30,
    position: 'stack',
    showLabels: false,
  },
  summaryMode: 'default',
  summaryStatistics: ['n', 'mean', 'sd', 'min', 'max'],
  omitMissing: true,
  groupBy: '',
  frequencyDisplay: 'count',
  showCount: true,
  showRowPercent: false,
  showColPercent: false,
  weights: '',
};

@Injectable()
export class DescribeDialogService {
  private readonly rService = inject(RService);

  // Core state signals
  private readonly _dataframe = signal<string>('');
  private readonly _selectedColumns = signal<ColumnInfo[]>([]);
  private readonly _outputMode = signal<OutputMode>('graph');
  
  // Graph state
  private readonly _graphType = signal<GraphType | null>(null);
  private readonly _graphOptions = signal<Partial<GraphOptions>>({ ...DEFAULT_STATE.graphOptions });
  
  // Summary state
  private readonly _summaryMode = signal<SummaryMode>('default');
  private readonly _summaryStatistics = signal<SummaryStatistic[]>([...DEFAULT_STATE.summaryStatistics]);
  private readonly _omitMissing = signal(true);
  private readonly _groupBy = signal('');
  
  // Frequency state
  private readonly _frequencyDisplay = signal<FrequencyDisplay>('count');
  private readonly _showCount = signal(true);
  private readonly _showRowPercent = signal(false);
  private readonly _showColPercent = signal(false);
  private readonly _weights = signal('');

  // Public readonly signals
  readonly dataframe = this._dataframe.asReadonly();
  readonly selectedColumns = this._selectedColumns.asReadonly();
  readonly outputMode = this._outputMode.asReadonly();
  readonly graphType = this._graphType.asReadonly();
  readonly graphOptions = this._graphOptions.asReadonly();
  readonly summaryMode = this._summaryMode.asReadonly();
  readonly summaryStatistics = this._summaryStatistics.asReadonly();
  readonly omitMissing = this._omitMissing.asReadonly();
  readonly groupBy = this._groupBy.asReadonly();
  readonly frequencyDisplay = this._frequencyDisplay.asReadonly();
  readonly showCount = this._showCount.asReadonly();
  readonly showRowPercent = this._showRowPercent.asReadonly();
  readonly showColPercent = this._showColPercent.asReadonly();
  readonly weights = this._weights.asReadonly();

  // Computed: Variable analysis
  readonly analysis = computed<VariableAnalysis>(() => {
    return analyzeVariables(this._selectedColumns());
  });

  // Computed: Available graph types for current selection
  readonly availableGraphs = computed<GraphConfig[]>(() => {
    const analysis = this.analysis();
    return analysis.recommendedGraphs.map(type => GRAPH_CONFIGS[type]);
  });

  // Computed: Is current selection valid for the output mode
  readonly isValid = computed<boolean>(() => {
    const df = this._dataframe();
    const cols = this._selectedColumns();
    const mode = this._outputMode();
    const analysis = this.analysis();

    if (!df || cols.length === 0) return false;

    switch (mode) {
      case 'summary':
        return analysis.supportsSummary;
      case 'graph':
        return this._graphType() !== null && analysis.recommendedGraphs.length > 0;
      case 'frequency':
        return analysis.supportsFrequency;
      default:
        return false;
    }
  });

  // Computed: Generated R code
  readonly rCode = computed<string>(() => {
    const df = this._dataframe();
    const cols = this._selectedColumns();
    const mode = this._outputMode();
    const analysis = this.analysis();

    if (!df || cols.length === 0) {
      return '# Select a dataframe and columns';
    }

    const columnNames = cols.map(c => c.name);

    switch (mode) {
      case 'summary':
        return this.buildSummaryCode(df, columnNames);
      case 'graph':
        return this.buildGraphCode(df, columnNames, analysis);
      case 'frequency':
        return this.buildFrequencyCode(df, columnNames);
      default:
        return '# Unknown output mode';
    }
  });

  // ============================================================================
  // State Setters
  // ============================================================================

  setDataframe(name: string): void {
    this._dataframe.set(name);
    // Reset column selection when dataframe changes
    this._selectedColumns.set([]);
    this._graphType.set(null);
  }

  setSelectedColumns(columns: ColumnInfo[]): void {
    this._selectedColumns.set(columns);
    
    // Auto-select graph type based on new analysis
    const analysis = analyzeVariables(columns);
    const currentGraphType = this._graphType();
    
    if (columns.length === 0) {
      // No columns - clear graph type
      this._graphType.set(null);
    } else if (!currentGraphType && analysis.defaultGraph) {
      // No graph type set - use default
      this._graphType.set(analysis.defaultGraph);
    } else if (currentGraphType && !analysis.recommendedGraphs.includes(currentGraphType)) {
      // Current graph type not valid for new selection - switch to default
      this._graphType.set(analysis.defaultGraph);
    }
  }

  setOutputMode(mode: OutputMode): void {
    this._outputMode.set(mode);
  }

  setGraphType(type: GraphType): void {
    this._graphType.set(type);
  }

  updateGraphOptions(options: Partial<GraphOptions>): void {
    this._graphOptions.update(current => ({ ...current, ...options }));
  }

  setSummaryMode(mode: SummaryMode): void {
    this._summaryMode.set(mode);
  }

  setSummaryStatistics(stats: SummaryStatistic[]): void {
    this._summaryStatistics.set(stats);
  }

  toggleSummaryStatistic(stat: SummaryStatistic): void {
    this._summaryStatistics.update(current => {
      if (current.includes(stat)) {
        return current.filter(s => s !== stat);
      }
      return [...current, stat];
    });
  }

  setOmitMissing(value: boolean): void {
    this._omitMissing.set(value);
  }

  setGroupBy(column: string): void {
    this._groupBy.set(column);
  }

  setFrequencyDisplay(display: FrequencyDisplay): void {
    this._frequencyDisplay.set(display);
  }

  setShowCount(value: boolean): void {
    this._showCount.set(value);
  }

  setShowRowPercent(value: boolean): void {
    this._showRowPercent.set(value);
  }

  setShowColPercent(value: boolean): void {
    this._showColPercent.set(value);
  }

  setWeights(column: string): void {
    this._weights.set(column);
  }

  // ============================================================================
  // Reset
  // ============================================================================

  reset(): void {
    this._dataframe.set(DEFAULT_STATE.dataframe);
    this._selectedColumns.set([]);
    this._outputMode.set(DEFAULT_STATE.outputMode);
    this._graphType.set(null);
    this._graphOptions.set({ ...DEFAULT_STATE.graphOptions });
    this._summaryMode.set(DEFAULT_STATE.summaryMode);
    this._summaryStatistics.set([...DEFAULT_STATE.summaryStatistics]);
    this._omitMissing.set(DEFAULT_STATE.omitMissing);
    this._groupBy.set(DEFAULT_STATE.groupBy);
    this._frequencyDisplay.set(DEFAULT_STATE.frequencyDisplay);
    this._showCount.set(DEFAULT_STATE.showCount);
    this._showRowPercent.set(DEFAULT_STATE.showRowPercent);
    this._showColPercent.set(DEFAULT_STATE.showColPercent);
    this._weights.set(DEFAULT_STATE.weights);
  }

  // ============================================================================
  // R Code Building
  // ============================================================================

  private buildSummaryCode(dataframe: string, columns: string[]): string {
    const options: SummaryOptions & { dataframe: string; columns: string[] } = {
      dataframe,
      columns,
      mode: this._summaryMode(),
      statistics: this._summaryStatistics(),
      omitMissing: this._omitMissing(),
      groupBy: this._groupBy() || undefined,
    };

    return buildSummaryCode(options);
  }

  private buildGraphCode(dataframe: string, columns: string[], analysis: VariableAnalysis): string {
    const graphType = this._graphType();
    if (!graphType) {
      return '# Select a graph type';
    }

    const currentOptions = this._graphOptions();
    const options: GraphOptions & { dataframe: string; columns: string[] } = {
      dataframe,
      columns,
      graphType,
      flipCoords: currentOptions.flipCoords,
      facetBy: currentOptions.facetBy,
      colorBy: currentOptions.colorBy,
      fillBy: currentOptions.fillBy,
      bins: currentOptions.bins,
      alpha: currentOptions.alpha,
      position: currentOptions.position,
      showLabels: currentOptions.showLabels,
      title: currentOptions.title,
      xLabel: currentOptions.xLabel,
      yLabel: currentOptions.yLabel,
    };

    return buildGraphCode(options, analysis);
  }

  private buildFrequencyCode(dataframe: string, columns: string[]): string {
    const options: FrequencyOptions & { dataframe: string; columns: string[] } = {
      dataframe,
      columns,
      display: this._frequencyDisplay(),
      showCount: this._showCount(),
      showRowPercent: this._showRowPercent(),
      showColPercent: this._showColPercent(),
      weights: this._weights() || undefined,
    };

    return buildFrequencyCode(options);
  }

  // ============================================================================
  // Execution
  // ============================================================================

  async execute(): Promise<{ success: boolean; error?: string }> {
    const code = this.rCode();
    
    if (!this.isValid()) {
      return { success: false, error: 'Invalid configuration' };
    }

    try {
      const result = await this.rService.execute(code);
      return { success: result.success, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }
}
