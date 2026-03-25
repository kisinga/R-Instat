import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from './pipeline-stage';
import { createPipelineContext } from './pipeline-stage';
import type { DataContext } from '../types/data-context.types';
import type { AICallResult } from '../types/ai-result.types';
import { AIConfigService } from '../../services/ai-config.service';

import { PiiGuardStage } from './stages/pii-guard.stage';
import { CategorizeStage } from './stages/categorize.stage';
import { VectorPreRankStage } from './stages/vector-prerank.stage';
import { ScopeStage } from './stages/scope.stage';
import { RecipeInterceptStage } from './stages/recipe-intercept.stage';
import { ValidateKeyStage } from './stages/validate-key.stage';
import { LlmCallStage } from './stages/llm-call.stage';
import { ParseResponseStage } from './stages/parse-response.stage';
import { DealiasStage } from './stages/dealias.stage';
import { PostGuardsStage } from './stages/post-guards.stage';
import { MemoryRecordStage } from './stages/memory-record.stage';

@Injectable({ providedIn: 'root' })
export class AIPipeline {
  private readonly aiConfig = inject(AIConfigService);

  private readonly stages: PipelineStage[] = [
    inject(PiiGuardStage),
    inject(CategorizeStage),
    inject(VectorPreRankStage),
    inject(ScopeStage),
    inject(RecipeInterceptStage),
    inject(ValidateKeyStage),
    inject(LlmCallStage),
    inject(ParseResponseStage),
    inject(DealiasStage),
    inject(PostGuardsStage),
    inject(MemoryRecordStage),
  ];

  async execute(
    userInput: string,
    dataContext: DataContext,
    options?: { signal?: AbortSignal }
  ): Promise<AICallResult> {
    const ctx = createPipelineContext(userInput, dataContext, {
      verbose: this.aiConfig.verboseAiDiagnostics(),
      signal: options?.signal,
    });

    for (const stage of this.stages) {
      if (ctx.signal?.aborted) {
        return {
          success: false,
          error: 'Request cancelled',
          privacyReport: ctx.privacyReport,
        };
      }

      try {
        const shouldContinue = await stage.execute(ctx);
        if (!shouldContinue) {
          return this.attachDiagnostics(ctx.earlyResult!, ctx);
        }
      } catch (err) {
        const msg = `[AI:${stage.id}] ${err instanceof Error ? err.message : String(err)}`;
        ctx.debugLog.push(msg);

        switch (stage.errorPolicy) {
          case 'fatal':
            return this.buildErrorResult(msg, ctx);
          case 'warn':
            ctx.warnings.push(msg);
            break;
          case 'silent':
            break;
        }
      }
    }

    return this.attachDiagnostics(
      {
        success: true,
        plan: ctx.finalPlan,
        retrievalReport: ctx.retrievalReport,
        privacyReport: ctx.privacyReport,
      },
      ctx
    );
  }

  private buildErrorResult(message: string, ctx: PipelineContext): AICallResult {
    // Detect common API error patterns for user-friendly messages
    const lower = message.toLowerCase();
    const is401 =
      message.includes('401') ||
      message.includes('403') ||
      lower.includes('incorrect api key') ||
      lower.includes('invalid x-api-key');
    const is429 =
      message.includes('429') ||
      lower.includes('quota') ||
      lower.includes('rate limit') ||
      lower.includes('insufficient_quota');

    let error: string;
    if (is401) {
      error = 'Invalid API key. Check your key in Settings.';
    } else if (is429) {
      const provider = ctx.provider ?? 'openai';
      error = provider === 'openai'
        ? 'OpenAI quota exceeded (429). Check your OpenAI billing/plan, or switch provider to Claude in AI Assist settings.'
        : 'Claude quota/rate limit reached (429). Check your Anthropic billing/plan, or switch provider to OpenAI in AI Assist settings.';
    } else {
      error = message;
    }

    return this.attachDiagnostics(
      {
        success: false,
        error,
        privacyReport: ctx.privacyReport,
      },
      ctx
    );
  }

  private attachDiagnostics(result: AICallResult, ctx: PipelineContext): AICallResult {
    if (ctx.warnings.length > 0) {
      result.warnings = ctx.warnings;
    }
    if (ctx.verbose && ctx.debugLog.length > 0) {
      result.debugLog = ctx.debugLog;
    }
    return result;
  }
}
