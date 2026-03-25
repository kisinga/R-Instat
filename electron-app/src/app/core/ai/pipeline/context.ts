/**
 * Decomposed pipeline context types.
 *
 * Replaces the monolithic PipelineContext with focused, composable types:
 * - PipelineInputs: immutable inputs set once at pipeline start
 * - PipelineState: accumulated mutable state built across stages
 * - PipelineDiagnostics: isolated diagnostics/logging
 * - PipelineContext: composition of all three
 */

import type { DataContext } from '../types/data-context.types';
import type { AIPlan, ModeDecision } from '../types';
import type { AliasMaps, PrivacyReport } from '../pii-guard';
import type { PromptCategory } from '../pipeline-types';
import type { DialogFamily } from '../dialog-catalog';
import type { ScopedPromptContext } from '../prompt-scoper.service';
import type { PreRankedCandidate } from '../dialog-context-retriever';
import type { EducationAIResponse } from '../../models/chat.model';
import type { AICallResult } from '../types/ai-result.types';

/** Conversation turn for multi-turn history */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Immutable inputs — set once, never mutated by stages */
export interface PipelineInputs {
  readonly userInput: string;
  readonly dataContext: DataContext;
  readonly conversationHistory: ConversationTurn[];
  readonly signal?: AbortSignal;
  readonly verbose: boolean;
}

/**
 * Accumulated state built across stages.
 * Each field is "owned" by a specific stage that sets it.
 */
export interface PipelineState {
  // PiiGuard owns
  aliasedInput?: string;
  aliasedContext?: DataContext;
  aliasMaps?: AliasMaps;
  privacyReport?: PrivacyReport;

  // Categorizer owns
  category?: PromptCategory;
  family?: DialogFamily;

  // VectorPreRank owns
  preRankedCandidates?: PreRankedCandidate[];

  // Scope owns
  scopedContext?: ScopedPromptContext;
  scopedDialogIds?: string[];

  // Scope + Categorize contribute
  modeDecision?: ModeDecision;

  // Scope / LLM owns
  userMessage?: string;
  apiKey?: string;
  provider?: 'openai' | 'claude';

  // LLM owns
  llmResponse?: string;

  // Parse owns
  parsedPlan?: AIPlan;

  // PostGuards / Dealias owns
  finalPlan?: AIPlan;

  // Education LLM owns
  educationResponse?: EducationAIResponse;

  // Reports
  retrievalReport?: AICallResult['retrievalReport'];
}

/** Diagnostics collector — isolated from business state */
export interface PipelineDiagnostics {
  readonly warnings: string[];
  readonly debugLog: string[];
  readonly verbose: boolean;
}

/** Full context = composition of focused types */
export interface PipelineContext {
  readonly inputs: PipelineInputs;
  readonly state: PipelineState;
  readonly diagnostics: PipelineDiagnostics;
}

/** Factory to create a fresh PipelineContext from inputs */
export function createPipelineContext(
  userInput: string,
  dataContext: DataContext,
  options?: {
    verbose?: boolean;
    signal?: AbortSignal;
    conversationHistory?: ConversationTurn[];
  }
): PipelineContext {
  return {
    inputs: {
      userInput,
      dataContext,
      conversationHistory: options?.conversationHistory ?? [],
      signal: options?.signal,
      verbose: options?.verbose ?? false,
    },
    state: {},
    diagnostics: {
      warnings: [],
      debugLog: [],
      verbose: options?.verbose ?? false,
    },
  };
}
