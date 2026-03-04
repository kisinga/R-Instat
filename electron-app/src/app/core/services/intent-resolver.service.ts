/**
 * Intent Resolver Service
 *
 * Strictly validates AI plan output and maps each step to DialogMetadata.
 */

import { Injectable } from '@angular/core';
import { DialogMetadata } from '../r-codegen/dialog-metadata';
import { getSchema, type DialogParamSchema } from '../ai/dialog-schema.registry';
import { OPERATION_REGISTRY } from '../ai/operation-registry';
import { getDialogContract } from '../ai/dialog-identity.registry';
import { ResolverTransformPipeline } from './intent-resolver.pipeline';
import type {
  AICallResult,
  AICodePlanStep,
  AIDialogPlanStep,
  AIPlanStep,
  DataContext,
  ExecutionMode,
} from './ai-client.service';

export interface ResolveResult {
  ok: boolean;
  plan?: ResolvedPlan;
  error?: string;
  warnings?: string[];
}

export interface ResolvedPlanStep {
  kind: 'dialog' | 'code';
  step: AIPlanStep;
  metadata?: DialogMetadata;
  code?: {
    script: string;
    expectedOutputs: string[];
    safetyFlags: string[];
    executionMode: 'structured_codegen' | 'direct_r';
  };
}

export interface ResolvedPlan {
  goal: string;
  assumptions: string[];
  clarificationQuestions: string[];
  overallConfidence: number;
  requiresConfirmation: boolean;
  executionMode: ExecutionMode;
  modeReason: string;
  modeConfidence: number;
  steps: ResolvedPlanStep[];
}

@Injectable({ providedIn: 'root' })
export class IntentResolverService {
  private readonly stateTransformPipeline = new ResolverTransformPipeline([
    {
      id: 'infer-missing-fields',
      scope: 'global',
      run: (dialogId, params, state, dataContext, warnings) =>
        this.inferMissingFields(dialogId, params, state, dataContext, warnings),
    },
    {
      id: 'normalize-filter-combine-logic',
      scope: 'dialog',
      dialogId: 'filter',
      run: (_dialogId, params, state, dataContext, warnings) =>
        this.normalizeFilterCombineLogic('filter', params, state, dataContext, warnings),
    },
    {
      id: 'normalize-column-references',
      scope: 'global',
      run: (dialogId, params, state, dataContext, warnings) =>
        this.normalizeColumnReferences(dialogId, params, state, dataContext, warnings),
    },
    {
      id: 'plotting-normalize-bar-chart-state',
      scope: 'dialog',
      dialogId: 'bar-chart',
      run: (_dialogId, params, state, dataContext, warnings) =>
        this.normalizeBarChartState('bar-chart', params, state, dataContext, warnings),
    },
  ]);

  resolve(result: AICallResult, dataContext: DataContext): ResolveResult {
    if (!result.success || !result.plan) {
      return { ok: false, error: result.error ?? 'No result' };
    }

    const allowedOperations = new Set(OPERATION_REGISTRY.map((x) => x.id));
    const warnings: string[] = [];
    const resolvedSteps: ResolvedPlanStep[] = [];
    const stepIdToIndex = new Map<string, number>();
    for (let i = 0; i < result.plan.steps.length; i++) {
      const step = result.plan.steps[i];
      if (!step.stepId || stepIdToIndex.has(step.stepId)) {
        return { ok: false, error: 'Step IDs must be unique and non-empty' };
      }
      stepIdToIndex.set(step.stepId, i);
    }

    for (const step of result.plan.steps) {
      if (step.stepType === 'code') {
        const codeStep = step as AICodePlanStep;
        const codeError = this.validateCodeStep(codeStep);
        if (codeError) {
          return { ok: false, error: codeError };
        }
        resolvedSteps.push({
          kind: 'code',
          step,
          code: {
            script: codeStep.script,
            expectedOutputs: codeStep.expectedOutputs,
            safetyFlags: codeStep.safetyFlags,
            executionMode: codeStep.executionMode,
          },
        });
        if (codeStep.confidence < 0.6) {
          warnings.push(`Low confidence code step: ${codeStep.stepId} (${codeStep.confidence.toFixed(2)})`);
        }
        continue;
      }

      const dialogStep = step as AIDialogPlanStep;
      const operation = OPERATION_REGISTRY.find((x) => x.id === dialogStep.operationId);
      if (!allowedOperations.has(dialogStep.operationId) || !operation) {
        return { ok: false, error: `Unknown operationId "${dialogStep.operationId}"` };
      }

      const schema = getSchema(dialogStep.dialogId);
      if (!schema) {
        return { ok: false, error: `Unknown dialog: ${dialogStep.dialogId}` };
      }
      if (!operation.mappedDialogs.includes(dialogStep.dialogId)) {
        return {
          ok: false,
          error: `Dialog "${dialogStep.dialogId}" is not compatible with operation "${dialogStep.operationId}"`,
        };
      }

      if (dialogStep.dependsOnStepId) {
        const parentIndex = stepIdToIndex.get(dialogStep.dependsOnStepId);
        const currentIndex = stepIdToIndex.get(dialogStep.stepId)!;
        if (parentIndex === undefined) {
          return { ok: false, error: `dependsOnStepId "${dialogStep.dependsOnStepId}" not found` };
        }
        if (parentIndex >= currentIndex) {
          return { ok: false, error: `dependsOnStepId must reference a previous step` };
        }
      }

      const state = this.applyStateTransforms(
        dialogStep.dialogId,
        schema.params,
        (dialogStep.state ?? {}) as Record<string, unknown>,
        dataContext,
        warnings
      );
      const allowedParams = new Set(schema.params.map((x) => x.name));

      for (const key of Object.keys(state)) {
        if (!allowedParams.has(key)) {
          return { ok: false, error: `Invalid param "${key}" for ${dialogStep.dialogId}` };
        }
      }

      // Validate required and conditional params
      for (const param of schema.params) {
        const active = this.isConditionActive(param, state);
        if (!active) continue;

        const value = state[param.name];
        if (param.required && (value === undefined || value === null || value === '')) {
          return { ok: false, error: `Missing required param "${param.name}" for ${dialogStep.dialogId}` };
        }
        if (value === undefined || value === null || value === '') continue;

        const typeError = this.validateParamType(param, value, state, dataContext);
        if (typeError) {
          return { ok: false, error: `Param "${param.name}" invalid for ${dialogStep.dialogId}: ${typeError}` };
        }
      }

      const contract = getDialogContract(dialogStep.dialogId);
      if (!contract) {
        return { ok: false, error: `No component for dialog: ${dialogStep.dialogId}` };
      }

      const metadata: DialogMetadata = {
        dialogId: dialogStep.dialogId,
        componentType: contract.componentType,
        version: '1.0',
        state: state as Record<string, any>,
        timestamp: new Date().toISOString(),
      };

      if (dialogStep.confidence < 0.6) {
        warnings.push(`Low confidence step: ${dialogStep.dialogId} (${dialogStep.confidence.toFixed(2)})`);
      }
      if (dialogStep.confidence < 0 || dialogStep.confidence > 1) {
        warnings.push(`Step confidence out of range for ${dialogStep.dialogId}; clamped by UI`);
      }

      resolvedSteps.push({ kind: 'dialog', step: dialogStep, metadata });
    }

    return {
      ok: true,
      warnings,
      plan: {
        goal: result.plan.goal,
        assumptions: result.plan.assumptions,
        clarificationQuestions: result.plan.clarificationQuestions,
        overallConfidence: result.plan.overallConfidence,
        requiresConfirmation: result.plan.requiresConfirmation,
        executionMode: result.plan.executionMode ?? 'component_codegen',
        modeReason: result.plan.modeReason ?? 'Mode not specified by planner.',
        modeConfidence: typeof result.plan.modeConfidence === 'number' ? result.plan.modeConfidence : 0.5,
        steps: resolvedSteps,
      },
    };
  }

  private applyStateTransforms(
    dialogId: string,
    params: DialogParamSchema[],
    initial: Record<string, unknown>,
    dataContext: DataContext,
    warnings: string[]
  ): Record<string, unknown> {
    const { state, diagnostics } = this.stateTransformPipeline.apply(
      dialogId,
      params,
      initial,
      dataContext,
      warnings
    );
    if (diagnostics.appliedTransformIds.length === 0) {
      warnings.push(`No resolver transforms applied for "${dialogId}"`);
    }
    return state;
  }

  private normalizeFilterCombineLogic(
    dialogId: string,
    _params: DialogParamSchema[],
    state: Record<string, unknown>,
    _dataContext: DataContext,
    _warnings: string[]
  ): Record<string, unknown> {
    if (dialogId !== 'filter') {
      return state;
    }

    const normalized = { ...state };
    const combineLogic = normalized['combineLogic'];
    if (combineLogic === 'and') {
      normalized['combineLogic'] = '&';
    } else if (combineLogic === 'or') {
      normalized['combineLogic'] = '|';
    }
    return normalized;
  }

  private normalizeBarChartState(
    dialogId: string,
    _params: DialogParamSchema[],
    state: Record<string, unknown>,
    _dataContext: DataContext,
    warnings: string[]
  ): Record<string, unknown> {
    if (dialogId !== 'bar-chart') {
      return state;
    }

    const normalized = { ...state };
    const chartType = normalized['chartType'];
    const hasYVariable = typeof normalized['yVariable'] === 'string' && normalized['yVariable'] !== '';

    // If model provides yVariable but omits chartType, infer value mode.
    if (!chartType && hasYVariable) {
      normalized['chartType'] = 'value';
      warnings.push('Inferred "chartType" as "value" for bar-chart because "yVariable" is set');
    }

    // If frequency is explicitly chosen, drop stray yVariable for deterministic restore behavior.
    if (normalized['chartType'] === 'frequency' && hasYVariable) {
      delete normalized['yVariable'];
      warnings.push('Removed "yVariable" for bar-chart because chartType is "frequency"');
    }

    return normalized;
  }

  private inferMissingFields(
    dialogId: string,
    params: DialogParamSchema[],
    state: Record<string, unknown>,
    dataContext: DataContext,
    warnings: string[]
  ): Record<string, unknown> {
    const normalized = { ...state };

    // Ensure dataframe is present for dialogs that require one.
    const dataframeParam = params.find((p) => p.name === 'dataframe');
    if (dataframeParam?.required && !normalized['dataframe']) {
      const fallbackDf = dataContext.activeDataframe ?? dataContext.dataframes[0];
      if (fallbackDf) {
        normalized['dataframe'] = fallbackDf;
        warnings.push(`Auto-selected dataframe "${fallbackDf}" for ${dialogId}`);
      }
    }

    const dfName = (normalized['dataframe'] as string) || dataContext.activeDataframe;
    const columns = dfName ? dataContext.columnsByDataframe[dfName] ?? [] : [];
    if (columns.length === 0) return normalized;

    for (const param of params) {
      const active = this.isConditionActive(param, normalized);
      if (!active || !param.required) continue;
      const current = normalized[param.name];
      if (current !== undefined && current !== null && current !== '') continue;

      if (param.kind === 'column') {
        const inferred = this.pickColumnForParam(param, columns, normalized);
        if (inferred) {
          normalized[param.name] = inferred;
          warnings.push(`Inferred "${param.name}" as "${inferred}" for ${dialogId}`);
        }
      } else if (param.kind === 'column[]') {
        const inferredMany = this.pickColumnsForParam(param, columns, normalized);
        if (inferredMany.length > 0) {
          normalized[param.name] = inferredMany;
          warnings.push(`Inferred "${param.name}" as [${inferredMany.join(', ')}] for ${dialogId}`);
        }
      } else if (param.kind === 'enum' && Array.isArray(param.enumValues) && param.enumValues.length > 0) {
        normalized[param.name] = param.enumValues[0];
        warnings.push(`Defaulted enum "${param.name}" to "${param.enumValues[0]}" for ${dialogId}`);
      }
    }

    return normalized;
  }

  private normalizeColumnReferences(
    dialogId: string,
    params: DialogParamSchema[],
    state: Record<string, unknown>,
    dataContext: DataContext,
    warnings: string[]
  ): Record<string, unknown> {
    const normalized = { ...state };
    const dfName = (state['dataframe'] as string) || dataContext.activeDataframe;
    if (!dfName) return normalized;

    const columns = dataContext.columnsByDataframe[dfName] ?? [];
    if (columns.length === 0) return normalized;
    const columnNames = columns.map((c) => c.name);

    const processed = new Set<string>();
    for (const param of params) {
      if (processed.has(param.name)) continue;
      processed.add(param.name);

      if (param.kind !== 'column' && param.kind !== 'column[]') continue;
      const value = normalized[param.name];
      if (value === undefined || value === null || value === '') continue;

      if (param.kind === 'column' && typeof value === 'string') {
        const resolved = this.resolveColumnName(value, columnNames);
        if (resolved && resolved !== value) {
          normalized[param.name] = resolved;
          warnings.push(`Adjusted column "${value}" to "${resolved}" for ${dialogId}`);
        }

        // Summary grouping expects a categorical/factor-like column.
        // If model picks numeric/date, fallback to a better group candidate or clear it.
        if (dialogId === 'summary' && param.name === 'groupByColumn') {
          const currentName = normalized[param.name];
          if (typeof currentName === 'string' && currentName) {
            const currentCol = columns.find((c) => c.name === currentName);
            const currentType = currentCol ? this.mapColumnType(currentCol.type) : 'any';
            if (currentType !== 'factor') {
              const fallback = this.findFallbackGroupColumn(columns, currentName);
              if (fallback) {
                normalized[param.name] = fallback;
                warnings.push(
                  `Adjusted summary groupByColumn from "${currentName}" to categorical column "${fallback}"`
                );
              } else {
                delete normalized[param.name];
                warnings.push(
                  `Removed summary groupByColumn "${currentName}" because it is not categorical`
                );
              }
            }
          }
        }
      }

      if (param.kind === 'column[]' && Array.isArray(value)) {
        const updated = value.map((item) => {
          if (typeof item !== 'string') return item;
          const resolved = this.resolveColumnName(item, columnNames);
          if (resolved && resolved !== item) {
            warnings.push(`Adjusted column "${item}" to "${resolved}" for ${dialogId}`);
            return resolved;
          }
          return item;
        });
        normalized[param.name] = updated;
      }
    }
    return normalized;
  }

  private validateCodeStep(step: AICodePlanStep): string | null {
    if (!step.script || !step.script.trim()) {
      return `Code step "${step.stepId}" has empty script`;
    }
    if (!Array.isArray(step.expectedOutputs)) {
      return `Code step "${step.stepId}" is missing expectedOutputs`;
    }
    if (!Array.isArray(step.safetyFlags)) {
      return `Code step "${step.stepId}" is missing safetyFlags`;
    }

    const riskyPatterns = [
      /\b(system|shell|unlink|file\.remove|write\.table|saveRDS|install\.packages)\s*\(/i,
      /\bsetwd\s*\(/i,
    ];
    if (riskyPatterns.some((rx) => rx.test(step.script))) {
      return `Code step "${step.stepId}" contains blocked side-effect commands`;
    }
    return null;
  }

  private resolveColumnName(candidate: string, availableColumns: string[]): string | null {
    if (availableColumns.includes(candidate)) {
      return candidate;
    }

    const lower = candidate.toLowerCase();
    const caseInsensitive = availableColumns.filter((c) => c.toLowerCase() === lower);
    if (caseInsensitive.length === 1) {
      return caseInsensitive[0];
    }

    const normCandidate = this.normalizeColumnToken(candidate);
    const normalizedMatches = availableColumns.filter(
      (c) => this.normalizeColumnToken(c) === normCandidate
    );
    if (normalizedMatches.length === 1) {
      return normalizedMatches[0];
    }

    const tokenMatch = availableColumns.filter((c) => {
      const norm = this.normalizeColumnToken(c);
      return norm.includes(normCandidate) || normCandidate.includes(norm);
    });
    if (tokenMatch.length === 1) {
      return tokenMatch[0];
    }

    return null;
  }

  private normalizeColumnToken(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private findFallbackGroupColumn(
    columns: Array<{ name: string; type: string }>,
    originalName: string
  ): string | null {
    const factorColumns = columns.filter((c) => this.mapColumnType(c.type) === 'factor');
    if (factorColumns.length === 0) return null;

    // Prefer entity-like columns for grouping.
    const preferred = factorColumns.find((c) =>
      /(user|name|group|owner|contributor|entity|region|country|sector|type|category|id)/i.test(c.name)
    );
    if (preferred) return preferred.name;

    // Secondary preference: any factor column not equal to original.
    const alternate = factorColumns.find((c) => c.name !== originalName);
    return (alternate ?? factorColumns[0]).name;
  }

  private isConditionActive(param: DialogParamSchema, state: Record<string, unknown>): boolean {
    if (!param.when) return true;
    return state[param.when.param] === param.when.equals;
  }

  private validateParamType(
    param: DialogParamSchema,
    value: unknown,
    state: Record<string, unknown>,
    dataContext: DataContext
  ): string | null {
    switch (param.kind) {
      case 'dataframe': {
        if (typeof value !== 'string') return 'must be a dataframe name string';
        if (!dataContext.dataframes.includes(value)) return `dataframe "${value}" not found`;
        return null;
      }
      case 'column': {
        if (typeof value !== 'string') return 'must be a column name string';
        const dfName = (state['dataframe'] as string) || dataContext.activeDataframe;
        if (!dfName) return 'no dataframe selected for column validation';
        const cols = dataContext.columnsByDataframe[dfName] ?? [];
        const col = cols.find((c) => c.name === value);
        if (!col) return `column "${value}" not found in dataframe "${dfName}"`;
        if (param.columnType && param.columnType !== 'any') {
          const mappedType = this.mapColumnType(col.type);
          if (mappedType !== param.columnType) {
            return `column "${value}" has type "${col.type}", expected ${param.columnType}`;
          }
        }
        return null;
      }
      case 'column[]': {
        if (!Array.isArray(value)) return 'must be an array of column names';
        const dfName = (state['dataframe'] as string) || dataContext.activeDataframe;
        if (!dfName) return 'no dataframe selected for column[] validation';
        const cols = dataContext.columnsByDataframe[dfName] ?? [];
        for (const item of value) {
          if (typeof item !== 'string') return 'column[] must contain strings';
          const col = cols.find((c) => c.name === item);
          if (!col) return `column "${item}" not found in dataframe "${dfName}"`;
          if (param.columnType && param.columnType !== 'any') {
            const mappedType = this.mapColumnType(col.type);
            if (mappedType !== param.columnType) {
              return `column "${item}" has type "${col.type}", expected ${param.columnType}`;
            }
          }
        }
        return null;
      }
      case 'enum': {
        if (typeof value !== 'string') return 'must be a string enum value';
        if (param.enumValues && !param.enumValues.includes(value)) {
          return `must be one of: ${param.enumValues.join(', ')}`;
        }
        return null;
      }
      case 'string[]': {
        if (!Array.isArray(value)) return 'must be an array of strings';
        return value.every((x) => typeof x === 'string') ? null : 'must be array of strings';
      }
      case 'boolean':
        return typeof value === 'boolean' ? null : 'must be boolean';
      case 'number': {
        if (typeof value !== 'number' || Number.isNaN(value)) return 'must be numeric';
        if (param.min !== undefined && value < param.min) return `must be >= ${param.min}`;
        if (param.max !== undefined && value > param.max) return `must be <= ${param.max}`;
        return null;
      }
      case 'string':
        return typeof value === 'string' ? null : 'must be string';
      case 'object[]': {
        if (!Array.isArray(value)) return 'must be an array';
        return value.every((x) => typeof x === 'object' && x !== null) ? null : 'must be array of objects';
      }
      default:
        return 'unsupported param type';
    }
  }

  private mapColumnType(rawType: string): 'numeric' | 'factor' | 'date' | 'any' {
    const t = rawType.toLowerCase();
    if (['numeric', 'integer', 'double'].some((x) => t.includes(x))) return 'numeric';
    if (['factor', 'character'].some((x) => t.includes(x))) return 'factor';
    if (['date', 'posix'].some((x) => t.includes(x))) return 'date';
    return 'any';
  }

  private pickColumnForParam(
    param: DialogParamSchema,
    columns: Array<{ name: string; type: string }>,
    state: Record<string, unknown>
  ): string | null {
    const requiredType = param.columnType ?? 'any';
    const used = this.getUsedColumnNames(state);
    const candidates = columns.filter((col) => {
      const mapped = this.mapColumnType(col.type);
      return (requiredType === 'any' || mapped === requiredType) && !used.has(col.name);
    });
    if (candidates.length === 0) return null;

    const scored = candidates
      .map((col) => ({ col, score: this.scoreColumnForParamName(col.name, param.name) }))
      .sort((a, b) => b.score - a.score);
    return scored[0]?.col.name ?? candidates[0].name;
  }

  private pickColumnsForParam(
    param: DialogParamSchema,
    columns: Array<{ name: string; type: string }>,
    state: Record<string, unknown>
  ): string[] {
    const requiredType = param.columnType ?? 'any';
    const used = this.getUsedColumnNames(state);
    const candidates = columns.filter((col) => {
      const mapped = this.mapColumnType(col.type);
      return (requiredType === 'any' || mapped === requiredType) && !used.has(col.name);
    });
    if (candidates.length === 0) return [];

    const sorted = candidates
      .map((col) => ({ col, score: this.scoreColumnForParamName(col.name, param.name) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.col.name);

    // Pick at least one, and up to two for better defaults in multivariate dialogs.
    return sorted.slice(0, Math.min(2, sorted.length));
  }

  private getUsedColumnNames(state: Record<string, unknown>): Set<string> {
    const used = new Set<string>();
    for (const value of Object.values(state)) {
      if (typeof value === 'string') {
        used.add(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') used.add(item);
        }
      }
    }
    return used;
  }

  private scoreColumnForParamName(columnName: string, paramName: string): number {
    const c = columnName.toLowerCase();
    const p = paramName.toLowerCase();

    let score = 0;
    if (c === p) score += 100;
    if (c.includes(p) || p.includes(c)) score += 40;

    const semanticBuckets: Array<{ keys: string[]; weight: number }> = [
      { keys: ['date', 'time', 'year', 'month', 'day'], weight: 30 },
      { keys: ['group', 'category', 'type', 'class', 'species'], weight: 24 },
      { keys: ['x', 'horizontal'], weight: 18 },
      { keys: ['y', 'value', 'measure', 'amount', 'height', 'weight', 'score'], weight: 20 },
      { keys: ['station', 'site', 'region', 'country'], weight: 20 },
      { keys: ['rain', 'temp', 'tmax', 'tmin'], weight: 18 },
    ];

    for (const bucket of semanticBuckets) {
      const matchesParam = bucket.keys.some((k) => p.includes(k));
      const matchesColumn = bucket.keys.some((k) => c.includes(k));
      if (matchesParam && matchesColumn) {
        score += bucket.weight;
      }
    }

    return score;
  }
}
