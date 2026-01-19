/**
 * Describe Dialog Service
 * 
 * Centralized state management and R code generation for the Describe dialog.
 * Coordinates between variable selection, output type, and R code building.
 * 
 * Uses explicit VariableRoles model where users explicitly set:
 * - analyze: Variables to explore (Y-axis for most graphs)
 * - groupBy: Grouping variable (X-axis)
 * - facetBy: Faceting variable (separate panels)
 * - colorBy: Color aesthetic
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { RService } from '../../../core/services/r.service';
import { ColumnInfo } from '../../../core/models/r.model';
import {
  VariableAnalysis,
  GraphType,
  GRAPH_CONFIGS,
  GraphConfig,
  VariableCombination,
  normalizeType,
  getRecommendedGraphs,
  getDefaultGraph,
  GraphMode,
  GraphModeConfig,
  GRAPH_MODE_CONFIGS,
  filterGraphsByMode,
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

/**
 * Explicit variable roles - set by user, not inferred.
 * This is the single source of truth for graph building.
 */
export interface VariableRoles {
  /** Variables to analyze (Y-axis for most graphs). Required. */
  analyze: ColumnInfo[];
  
  /** Grouping variable (X-axis). Optional. */
  groupBy?: ColumnInfo;
  
  /** Faceting variable. Optional, must be categorical. */
  facetBy?: ColumnInfo;
  
  /** Color aesthetic. Optional. */
  colorBy?: ColumnInfo;
}

/** State of the describe dialog */
export interface DescribeDialogState {
  // Data selection
  dataframe: string;
  roles: VariableRoles;
  
  // Output mode
  outputMode: OutputMode;
  
  // Graph options
  graphType: GraphType | null;
  graphOptions: Partial<GraphOptions>;
  
  // Summary options
  summaryMode: SummaryMode;
  summaryStatistics: SummaryStatistic[];
  omitMissing: boolean;
  summaryGroupBy: string;
  
  // Frequency options
  frequencyDisplay: FrequencyDisplay;
  showCount: boolean;
  showRowPercent: boolean;
  showColPercent: boolean;
  weights: string;
}

/** Default roles state */
const DEFAULT_ROLES: VariableRoles = {
  analyze: [],
  groupBy: undefined,
  facetBy: undefined,
  colorBy: undefined,
};

/** Default state */
const DEFAULT_STATE: DescribeDialogState = {
  dataframe: '',
  roles: { ...DEFAULT_ROLES },
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
  summaryGroupBy: '',
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
  private readonly _roles = signal<VariableRoles>({ ...DEFAULT_ROLES });
  private readonly _outputMode = signal<OutputMode>('graph');
  
  // Graph state
  private readonly _graphMode = signal<GraphMode>('distribution');
  private readonly _graphType = signal<GraphType | null>(null);
  private readonly _graphOptions = signal<Partial<GraphOptions>>({ ...DEFAULT_STATE.graphOptions });
  
  // Summary state
  private readonly _summaryMode = signal<SummaryMode>('default');
  private readonly _summaryStatistics = signal<SummaryStatistic[]>([...DEFAULT_STATE.summaryStatistics]);
  private readonly _omitMissing = signal(true);
  private readonly _summaryGroupBy = signal('');
  
  // Frequency state
  private readonly _frequencyDisplay = signal<FrequencyDisplay>('count');
  private readonly _showCount = signal(true);
  private readonly _showRowPercent = signal(false);
  private readonly _showColPercent = signal(false);
  private readonly _weights = signal('');

  // Public readonly signals
  readonly dataframe = this._dataframe.asReadonly();
  readonly roles = this._roles.asReadonly();
  readonly outputMode = this._outputMode.asReadonly();
  readonly graphMode = this._graphMode.asReadonly();
  readonly graphType = this._graphType.asReadonly();
  readonly graphOptions = this._graphOptions.asReadonly();
  readonly summaryMode = this._summaryMode.asReadonly();
  readonly summaryStatistics = this._summaryStatistics.asReadonly();
  readonly omitMissing = this._omitMissing.asReadonly();
  readonly summaryGroupBy = this._summaryGroupBy.asReadonly();
  readonly frequencyDisplay = this._frequencyDisplay.asReadonly();
  readonly showCount = this._showCount.asReadonly();
  readonly showRowPercent = this._showRowPercent.asReadonly();
  readonly showColPercent = this._showColPercent.asReadonly();
  readonly weights = this._weights.asReadonly();

  /**
   * Compute the variable combination from explicit roles.
   * This replaces the old type-inferring analyzeVariables() approach.
   */
  readonly combination = computed<VariableCombination>(() => {
    const roles = this._roles();
    return this.getCombinationFromRoles(roles);
  });

  /**
   * Current mode configuration - exposes UI control properties.
   */
  readonly modeConfig = computed<GraphModeConfig>(() => 
    GRAPH_MODE_CONFIGS[this._graphMode()]
  );

  /**
   * Compute available graph types based on the combination and graph mode.
   * Uses filterGraphsByMode for clean separation of concerns.
   */
  readonly availableGraphs = computed<GraphConfig[]>(() => {
    const combo = this.combination();
    const mode = this._graphMode();
    const recommendedGraphs = getRecommendedGraphs(combo);
    const filteredGraphs = filterGraphsByMode(recommendedGraphs, mode);
    return filteredGraphs.map(type => GRAPH_CONFIGS[type]);
  });

  /**
   * Legacy analysis computed for backward compatibility.
   * @deprecated Use roles() and combination() instead.
   */
  readonly analysis = computed<VariableAnalysis>(() => {
    const roles = this._roles();
    const combo = this.combination();
    const types = roles.analyze.map(c => normalizeType(c.type));
    
    return {
      selectedColumns: roles.analyze,
      types,
      combination: combo,
      numericCount: types.filter(t => t === 'numeric').length,
      categoricalCount: types.filter(t => t === 'categorical').length,
      recommendedGraphs: getRecommendedGraphs(combo),
      supportsSummary: roles.analyze.length > 0,
      supportsFrequency: roles.analyze.length > 0,
      defaultGraph: getDefaultGraph(combo),
    };
  });

  // Computed: Is current selection valid for the output mode
  readonly isValid = computed<boolean>(() => {
    const df = this._dataframe();
    const roles = this._roles();
    const mode = this._outputMode();

    if (!df || roles.analyze.length === 0) return false;

    switch (mode) {
      case 'summary':
        return true;
      case 'graph':
        return this._graphType() !== null && this.availableGraphs().length > 0;
      case 'frequency':
        return true;
      default:
        return false;
    }
  });

  // Computed: Generated R code
  readonly rCode = computed<string>(() => {
    const df = this._dataframe();
    const roles = this._roles();
    const mode = this._outputMode();

    if (!df || roles.analyze.length === 0) {
      return '# Select a dataframe and variables to analyze';
    }

    const columnNames = roles.analyze.map(c => c.name);

    switch (mode) {
      case 'summary':
        return this.buildSummaryCode(df, columnNames);
      case 'graph':
        return this.buildGraphCodeFromRoles(df, roles);
      case 'frequency':
        return this.buildFrequencyCode(df, columnNames);
      default:
        return '# Unknown output mode';
    }
  });

  // ============================================================================
  // Combination Detection from Roles
  // ============================================================================

  /**
   * Derive combination based on explicit roles.
   * This is the core logic that determines which graphs are appropriate.
   */
  private getCombinationFromRoles(roles: VariableRoles): VariableCombination {
    const analyzeTypes = roles.analyze.map(c => normalizeType(c.type));
    const groupByType = roles.groupBy ? normalizeType(roles.groupBy.type) : null;
    
    // No variables selected
    if (roles.analyze.length === 0) {
      return 'none';
    }
    
    // Single variable, no grouping
    if (roles.analyze.length === 1 && !roles.groupBy) {
      return analyzeTypes[0] === 'numeric' ? 'single-numeric' : 'single-categorical';
    }
    
    // Multiple analyze variables, no grouping → pairs/matrix
    if (roles.analyze.length >= 2 && !roles.groupBy) {
      const allNumeric = analyzeTypes.every(t => t === 'numeric');
      const allCategorical = analyzeTypes.every(t => t === 'categorical');
      if (allNumeric) return 'multi-numeric';
      if (allCategorical) return 'multi-categorical';
      return 'mixed';
    }
    
    // With grouping: determine combination from types
    const primaryType = analyzeTypes[0]; // For graph purposes, use first
    if (primaryType === 'numeric' && groupByType === 'numeric') {
      return 'multi-numeric';
    }
    if (primaryType === 'numeric' && groupByType === 'categorical') {
      return 'numeric-by-categorical';
    }
    if (primaryType === 'categorical' && groupByType === 'numeric') {
      return 'categorical-by-numeric';
    }
    return 'categorical-by-categorical';
  }

  // ============================================================================
  // State Setters
  // ============================================================================

  setDataframe(name: string): void {
    this._dataframe.set(name);
    // Reset roles when dataframe changes
    this._roles.set({ ...DEFAULT_ROLES });
    this._graphType.set(null);
  }

  /**
   * Set the "Analyze" variables (primary variables to explore)
   */
  setAnalyzeVariables(columns: ColumnInfo[]): void {
    this._roles.update(current => ({ ...current, analyze: columns }));
    this.updateGraphTypeForNewCombination();
  }

  /**
   * Set the "Group by" variable (comparison/x-axis variable)
   */
  setGroupByVariable(column: ColumnInfo | undefined): void {
    this._roles.update(current => ({ ...current, groupBy: column }));
    this.updateGraphTypeForNewCombination();
  }

  /**
   * Set the "Facet by" variable (creates separate panels)
   */
  setFacetByVariable(column: ColumnInfo | undefined): void {
    this._roles.update(current => ({ ...current, facetBy: column }));
  }

  /**
   * Set the "Color by" variable (color aesthetic)
   */
  setColorByVariable(column: ColumnInfo | undefined): void {
    this._roles.update(current => ({ ...current, colorBy: column }));
  }

  /**
   * Auto-update graph type when combination changes
   */
  private updateGraphTypeForNewCombination(): void {
    const combo = this.getCombinationFromRoles(this._roles());
    const recommendedGraphs = getRecommendedGraphs(combo);
    const currentGraphType = this._graphType();
    
    if (this._roles().analyze.length === 0) {
      this._graphType.set(null);
    } else if (!currentGraphType || !recommendedGraphs.includes(currentGraphType)) {
      // Current graph type not valid - switch to default
      this._graphType.set(getDefaultGraph(combo));
    }
  }

  /**
   * Legacy setter for backward compatibility
   * @deprecated Use setAnalyzeVariables and setGroupByVariable instead
   */
  setSelectedColumns(columns: ColumnInfo[]): void {
    this.setAnalyzeVariables(columns);
  }

  setOutputMode(mode: OutputMode): void {
    this._outputMode.set(mode);
  }

  setGraphMode(mode: GraphMode): void {
    this._graphMode.set(mode);
    // Reset graph type when mode changes since available graphs change
    this._graphType.set(null);
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

  setSummaryGroupBy(column: string): void {
    this._summaryGroupBy.set(column);
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
    this._roles.set({ ...DEFAULT_ROLES });
    this._outputMode.set(DEFAULT_STATE.outputMode);
    this._graphType.set(null);
    this._graphOptions.set({ ...DEFAULT_STATE.graphOptions });
    this._summaryMode.set(DEFAULT_STATE.summaryMode);
    this._summaryStatistics.set([...DEFAULT_STATE.summaryStatistics]);
    this._omitMissing.set(DEFAULT_STATE.omitMissing);
    this._summaryGroupBy.set(DEFAULT_STATE.summaryGroupBy);
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
      groupBy: this._summaryGroupBy() || undefined,
    };

    return buildSummaryCode(options);
  }

  /**
   * Build graph code using explicit roles.
   * This is the new roles-aware graph code builder.
   */
  private buildGraphCodeFromRoles(dataframe: string, roles: VariableRoles): string {
    const graphType = this._graphType();
    if (!graphType) {
      return '# Select a graph type';
    }

    const currentOptions = this._graphOptions();
    
    // Build columns array - primary analyze vars
    const columns = roles.analyze.map(c => c.name);
    
    // If we have a groupBy, add it to columns for the builder
    // The builder will use roles to determine axis mapping
    if (roles.groupBy) {
      columns.push(roles.groupBy.name);
    }

    const options: GraphOptions & { dataframe: string; columns: string[] } = {
      dataframe,
      columns,
      graphType,
      flipCoords: currentOptions.flipCoords,
      // Use explicit facetBy from roles, not from graphOptions
      facetBy: roles.facetBy?.name ?? currentOptions.facetBy,
      // Use explicit colorBy from roles
      colorBy: roles.colorBy?.name ?? currentOptions.colorBy,
      fillBy: currentOptions.fillBy,
      bins: currentOptions.bins,
      alpha: currentOptions.alpha,
      position: currentOptions.position,
      showLabels: currentOptions.showLabels,
      title: currentOptions.title,
      xLabel: currentOptions.xLabel,
      yLabel: currentOptions.yLabel,
    };

    // Build analysis object for the builder (for backward compatibility)
    const analysis = this.analysis();
    
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
