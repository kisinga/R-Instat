/**
 * Education-specific LLM call stage.
 *
 * Uses the same LLMProvider transport as LlmCallStage but with:
 * - EDUCATION_SYSTEM_PROMPT instead of PLANNER_SYSTEM_PROMPT
 * - Conversation history for multi-turn context
 * - Dialog summaries (compact) instead of full contracts
 * - Parses response into EducationAIResponse (not AIPlan)
 */

import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { AIConfigService } from '../../../services/ai-config.service';
import { LLMProviderFactory } from '../../providers/llm-provider.factory';
import { ResponseParser } from '../response-parser';
import {
  EDUCATION_SYSTEM_PROMPT,
  buildDialogSummaries,
  buildEducationUserMessage,
} from '../../prompt/education-prompt';
import { getDialogContractsForPrompt } from '../../dialog-catalog-aggregator';
import { deAliasScript } from '../../pii-guard';
import type { EducationAIResponse } from '../../../models/chat.model';

@Injectable({ providedIn: 'root' })
export class EducationLlmCallStage implements PipelineStage {
  readonly id = 'education-llm-call';
  readonly errorPolicy = 'fatal' as const;

  private readonly aiConfig = inject(AIConfigService);
  private readonly llmFactory = inject(LLMProviderFactory);
  private readonly responseParser = inject(ResponseParser);

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const provider = this.llmFactory.getProvider();
    const modelConfig = this.aiConfig.modelConfig();

    const dialogSummaries = buildDialogSummaries(getDialogContractsForPrompt());

    // Cap history to last 6 messages for token efficiency
    const history = ctx.inputs.conversationHistory.slice(-6);

    const userMessage = buildEducationUserMessage(
      ctx.state.aliasedInput!,
      ctx.state.aliasedContext ?? ctx.inputs.dataContext,
      dialogSummaries,
      history
    );

    const response = await provider.call(ctx.state.apiKey!, {
      systemPrompt: EDUCATION_SYSTEM_PROMPT,
      userMessage,
      responseFormat: 'json',
      model: modelConfig.plannerModel,
      temperature: 0.3,
      maxTokens: modelConfig.plannerMaxTokens,
    });

    const parsed = this.parseResponse(response.content, ctx);
    if (!parsed) {
      console.warn('[EducationLlmCall] Failed to parse JSON from AI response:', response.content);
      return Stage.terminate({
        success: false,
        error: 'Failed to parse education response from AI.',
        rawResponse: response.content,
        privacyReport: ctx.state.privacyReport,
      });
    }

    ctx.state.educationResponse = parsed;
    return Stage.continue();
  }

  private parseResponse(
    content: string,
    ctx: PipelineContext
  ): EducationAIResponse | null {
    return this.responseParser.extractJson<EducationAIResponse>(content, (raw: unknown) => {
      if (typeof raw !== 'object' || raw === null) return null;
      const obj = raw as Record<string, unknown>;

      const explanation = typeof obj['explanation'] === 'string'
        ? (ctx.state.aliasMaps ? deAliasScript(obj['explanation'], ctx.state.aliasMaps) : obj['explanation'])
        : '';

      const highlights = Array.isArray(obj['highlights'])
        ? obj['highlights'].filter(
            (h: unknown): h is { dialogId: string; relevanceNote: string } => {
              if (typeof h !== 'object' || h === null) return false;
              const rec = h as Record<string, unknown>;
              return typeof rec['dialogId'] === 'string' && typeof rec['relevanceNote'] === 'string';
            }
          )
        : [];

      const followUpSuggestions = Array.isArray(obj['followUpSuggestions'])
        ? obj['followUpSuggestions'].filter((s: unknown): s is string => typeof s === 'string')
        : [];

      return { explanation, highlights, followUpSuggestions };
    });
  }
}
