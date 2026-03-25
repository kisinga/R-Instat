/**
 * Composable pipeline orchestrator.
 *
 * Provides the shared stage execution loop that both AIPipeline and
 * EducationPipeline delegate to. Handles:
 * - Sequential stage execution with typed StageResult dispatch
 * - Error policy enforcement (fatal / warn / silent)
 * - Abort signal checking between stages
 * - Diagnostics collection
 *
 * Each pipeline provides a PipelineConfig with its specific stages,
 * result mapper, and error normalizer. No orchestration logic is
 * duplicated between pipelines.
 */

import { Injectable, inject } from '@angular/core';
import type { PipelineInputs, PipelineState, PipelineDiagnostics, PipelineContext } from './context';
import type { PipelineStage, StageResult } from './stage';
import { ErrorNormalizer } from './error-normalizer';

export interface PipelineConfig<TResult> {
  /** Ordered stages to execute */
  stages: PipelineStage[];
  /** Maps final pipeline state to the pipeline-specific result type */
  resultMapper: (state: PipelineState, diagnostics: PipelineDiagnostics, inputs: PipelineInputs) => TResult;
  /** Label for log prefixes (e.g., 'AI', 'Education') */
  label: string;
}

@Injectable({ providedIn: 'root' })
export class PipelineOrchestrator {
  private readonly errorNormalizer = inject(ErrorNormalizer);

  async execute<TResult>(
    inputs: PipelineInputs,
    config: PipelineConfig<TResult>
  ): Promise<TResult> {
    const state: PipelineState = {};
    const diagnostics: PipelineDiagnostics = {
      warnings: [],
      debugLog: [],
      verbose: inputs.verbose,
    };
    const ctx: PipelineContext = { inputs, state, diagnostics };

    for (const stage of config.stages) {
      // Check abort between stages
      if (inputs.signal?.aborted) {
        return config.resultMapper(state, diagnostics, inputs);
      }

      try {
        const result = await stage.execute(ctx);

        switch (result.action) {
          case 'continue':
            break;
          case 'terminate':
            return this.attachDiagnostics(result.result as unknown as Record<string, unknown>, diagnostics) as TResult;
          case 'skip-remaining':
            return config.resultMapper(state, diagnostics, inputs);
        }
      } catch (err) {
        const msg = `[${config.label}:${stage.id}] ${err instanceof Error ? err.message : String(err)}`;
        diagnostics.debugLog.push(msg);

        switch (stage.errorPolicy) {
          case 'fatal': {
            const friendlyError = this.errorNormalizer.normalize(msg, state.provider);
            return this.attachDiagnostics(
              { success: false, error: friendlyError, privacyReport: state.privacyReport },
              diagnostics
            ) as TResult;
          }
          case 'warn':
            diagnostics.warnings.push(msg);
            break;
          case 'silent':
            break;
        }
      }
    }

    return config.resultMapper(state, diagnostics, inputs);
  }

  private attachDiagnostics(
    result: Record<string, unknown>,
    diagnostics: PipelineDiagnostics
  ): Record<string, unknown> {
    if (diagnostics.warnings.length > 0) {
      result['warnings'] = diagnostics.warnings;
    }
    if (diagnostics.verbose && diagnostics.debugLog.length > 0) {
      result['debugLog'] = diagnostics.debugLog;
    }
    return result;
  }
}
