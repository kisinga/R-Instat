/**
 * AI Plan types — derived from the Zod schema in electron/schemas/plan.schema.ts.
 *
 * The Zod schema is the single source of truth. These types provide
 * narrower views for downstream renderer code that needs dialog/code
 * step discrimination.
 */

import type { ExecutionMode } from './data-context.types';

/** Clarification items — discriminated union for choices vs questions */
export type ClarificationItem =
  | { kind: 'choice'; options: string[] }
  | { kind: 'question'; text: string };

export interface AIBasePlanStep {
  stepId: string;
  dependsOnStepId?: string | null;
  inferredFields: string[];
  confidence: number;
  rationale?: string;
}

export interface AIDialogPlanStep extends AIBasePlanStep {
  stepType?: 'dialog';
  operationId: string;
  dialogId: string;
  state: Record<string, unknown>;
}

export interface AICodePlanStep extends AIBasePlanStep {
  stepType: 'code';
  executionMode: 'structured_codegen' | 'direct_r';
  script: string;
  expectedOutputs: string[];
  safetyFlags: string[];
  operationId?: string;
  dialogId?: string;
  state?: Record<string, unknown>;
}

export type AIPlanStep = AIDialogPlanStep | AICodePlanStep;

export interface AIPlan {
  goal: string;
  assumptions: string[];
  clarifications: ClarificationItem[];
  overallConfidence: number;
  requiresConfirmation: boolean;
  executionMode: ExecutionMode;
  modeReason: string;
  modeConfidence: number;
  steps: AIPlanStep[];
}
