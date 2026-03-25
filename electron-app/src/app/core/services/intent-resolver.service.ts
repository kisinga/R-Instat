/**
 * Intent Resolver Service
 *
 * Strictly validates AI plan output and maps each step to DialogMetadata.
 */

import { Injectable } from '@angular/core';
import { DialogMetadata } from '../r-codegen/dialog-metadata';
import { getSchema } from '../ai/dialog-catalog-aggregator';
import type { DialogParamSchema } from '../ai/dialog-schema.registry';
import { buildDialogMetadata } from '../ai/dialog-metadata-builder';
import { OPERATION_REGISTRY } from '../ai/operation-registry';
import { extractStepDelta, applyDeltasToContext, type StepOutputDelta } from '../ai/step-output-delta';
import { ResolverTransformPipeline } from './intent-resolver.pipeline';
import { createDefaultTransforms } from '../ai/transforms';
import { mapColumnType } from '../ai/shared/column-type-mapper';
import { isValidOperationId } from '../ai/shared/operation-validator';
import type {
  AICallResult,
  AICodePlanStep,
  AIDialogPlanStep,
  AIPlanStep,
  DataContext,
  ExecutionMode,
} from '../ai/types';

export interface ResolveResult {
  ok: boolean;
  plan?: ResolvedPlan;
  error?: string;
  warnings?: string[];
  /** When true, intent was unclear; show disambiguationSuggestions (from AIClientService, not resolver). */
  needsDisambiguation?: boolean;
  /** Category-directed suggestions; only set when needsDisambiguation is true. */
  disambiguationSuggestions?: Array<{ text: string; category: string }>;
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
  private readonly stateTransformPipeline = new ResolverTransformPipeline(
    createDefaultTransforms()
  );

  resolve(result: AICallResult, dataContext: DataContext): ResolveResult {
    if (!result.success || !result.plan) {
      return { ok: false, error: result.error ?? 'No result' };
    }

    const allowedOperations = new Set(OPERATION_REGISTRY.map((x) => x.id));
    const warnings: string[] = [];
    const resolvedSteps: ResolvedPlanStep[] = [];
    const accumulatedDeltas: StepOutputDelta[] = [];
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
      const rawOpId = dialogStep.operationId;
      if (!isValidOperationId(rawOpId)) {
        return {
          ok: false,
          error:
            "This request couldn't be matched to a specific analysis. For conceptual questions (e.g. 'What does a t-test tell us?') try asking to run a t-test on your data from the menu, or rephrase as a request to perform an analysis.",
        };
      }
      const operation = OPERATION_REGISTRY.find((x) => x.id === rawOpId);
      if (!allowedOperations.has(rawOpId) || !operation) {
        return { ok: false, error: `Unknown operationId "${rawOpId}"` };
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

      const augmentedContext = accumulatedDeltas.length > 0
        ? applyDeltasToContext(dataContext, accumulatedDeltas, (dialogStep.state as Record<string, unknown>)?.['dataframe'] as string | undefined) as DataContext
        : dataContext;

      const { state, diagnostics } = this.stateTransformPipeline.apply(
        dialogStep.dialogId,
        schema.params,
        (dialogStep.state ?? {}) as Record<string, unknown>,
        augmentedContext,
        warnings
      );
      if (diagnostics.appliedTransformIds.length === 0) {
        warnings.push(`No resolver transforms applied for "${dialogStep.dialogId}"`);
      }

      const allowedParams = new Set(schema.params.map((x) => x.name));

      for (const key of Object.keys(state)) {
        if (!allowedParams.has(key)) {
          return { ok: false, error: `Invalid param "${key}" for ${dialogStep.dialogId}` };
        }
      }

      for (const param of schema.params) {
        const active = this.isConditionActive(param, state);
        if (!active) continue;

        const value = state[param.name];
        if (param.required && (value === undefined || value === null || value === '')) {
          return { ok: false, error: `Missing required param "${param.name}" for ${dialogStep.dialogId}` };
        }
        if (value === undefined || value === null || value === '') continue;

        const typeError = this.validateParamType(param, value, state, augmentedContext);
        if (typeError) {
          return { ok: false, error: `Param "${param.name}" invalid for ${dialogStep.dialogId}: ${typeError}` };
        }
      }

      const metadata = buildDialogMetadata(dialogStep.dialogId, state as Record<string, any>, {
        version: '1.0',
        timestamp: new Date().toISOString(),
      });
      if (!metadata) {
        return { ok: false, error: `No component for dialog: ${dialogStep.dialogId}` };
      }

      if (dialogStep.confidence < 0.6) {
        warnings.push(`Low confidence step: ${dialogStep.dialogId} (${dialogStep.confidence.toFixed(2)})`);
      }
      if (dialogStep.confidence < 0 || dialogStep.confidence > 1) {
        warnings.push(`Step confidence out of range for ${dialogStep.dialogId}; clamped by UI`);
      }

      const delta = extractStepDelta(dialogStep.dialogId, state);
      accumulatedDeltas.push(delta);

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
          const mappedType = mapColumnType(col.type);
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
            const mappedType = mapColumnType(col.type);
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
}
