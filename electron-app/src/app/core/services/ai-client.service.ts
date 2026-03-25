/**
 * AI Client Service — Slim Facade
 *
 * Delegates to AIPipeline for the full Categorize → Scope → Plan flow.
 * Preserves the injection point for the UI component.
 */

import { Injectable, inject } from '@angular/core';
import { AIPipeline } from '../ai/pipeline/ai-pipeline';
import type { DataContext } from '../ai/types/data-context.types';
import type { AICallResult } from '../ai/types/ai-result.types';

// Re-export all types for consumers that import from this file
export type {
  DataContext,
  ExecutionMode,
  AIPlan,
  AIPlanStep,
  AIDialogPlanStep,
  AICodePlanStep,
  AIBasePlanStep,
  AICallResult,
  ClarificationItem,
  DisambiguationSuggestion,
} from '../ai/types';

@Injectable({ providedIn: 'root' })
export class AIClientService {
  private readonly pipeline = inject(AIPipeline);

  async call(userInput: string, dataContext: DataContext): Promise<AICallResult> {
    return this.pipeline.execute(userInput, dataContext);
  }
}
