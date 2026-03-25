import type { DataContext, ExecutionMode } from '../types/data-context.types';
import type { AIPlan, AICallResult, ModeDecision } from '../types';
import type { AliasMaps, PrivacyReport } from '../pii-guard';
import type { PromptCategory } from '../pipeline-types';
import type { DialogFamily } from '../dialog-catalog';
import type { ScopedPromptContext } from '../prompt-scoper.service';
import type { PreRankedCandidate } from '../dialog-context-retriever';

export type StageErrorPolicy = 'silent' | 'warn' | 'fatal';

export interface PipelineContext {
  // Inputs (set once at pipeline start)
  readonly rawUserInput: string;
  readonly rawDataContext: DataContext;

  // Accumulated state across stages
  aliasedInput?: string;
  aliasedContext?: DataContext;
  aliasMaps?: AliasMaps;
  privacyReport?: PrivacyReport;

  category?: PromptCategory;
  family?: DialogFamily;

  preRankedCandidates?: PreRankedCandidate[];
  scopedContext?: ScopedPromptContext;
  scopedDialogIds?: string[];

  modeDecision?: ModeDecision;

  // LLM context
  apiKey?: string;
  provider?: 'openai' | 'claude';
  userMessage?: string;

  parsedPlan?: AIPlan;
  finalPlan?: AIPlan;

  // Reports
  retrievalReport?: AICallResult['retrievalReport'];

  // Short-circuit
  earlyResult?: AICallResult;

  // Education-specific (optional, set only by EducationPipeline)
  educationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  educationResponse?: import('../../models/education-chat.model').EducationAIResponse;

  // Diagnostics
  warnings: string[];
  debugLog: string[];
  verbose: boolean;

  // Cancellation
  signal?: AbortSignal;
}

export interface PipelineStage {
  readonly id: string;
  readonly errorPolicy: StageErrorPolicy;
  execute(ctx: PipelineContext): Promise<boolean>;
}

export function createPipelineContext(
  userInput: string,
  dataContext: DataContext,
  options?: { verbose?: boolean; signal?: AbortSignal }
): PipelineContext {
  return {
    rawUserInput: userInput,
    rawDataContext: dataContext,
    warnings: [],
    debugLog: [],
    verbose: options?.verbose ?? false,
    signal: options?.signal,
  };
}
