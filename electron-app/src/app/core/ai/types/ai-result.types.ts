import type { AIPlan } from './ai-plan.types';
import type { ExecutionMode } from './data-context.types';
import type { PromptCategory } from '../pipeline-types';

export interface DisambiguationSuggestion {
  text: string;
  category: PromptCategory;
}

export interface ModeDecision {
  mode: ExecutionMode;
  reason: string;
  confidence: number;
}

export interface AICallResult {
  success: boolean;
  plan?: AIPlan;
  error?: string;
  rawResponse?: string;
  needsDisambiguation?: boolean;
  disambiguationSuggestions?: DisambiguationSuggestion[];
  retrievalReport?: {
    enabled: boolean;
    topK: number;
    selectedDialogIds: string[];
    explainability: Array<{ dialogId: string; score: number; reasons: string[] }>;
  };
  privacyReport?: {
    redactedPatterns: string[];
    aliasedDataframes: number;
    aliasedColumns: number;
  };
  warnings?: string[];
  debugLog?: string[];
}
