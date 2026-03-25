import type { ExecutionMode } from './data-context.types';

export interface AIBasePlanStep {
  stepId: string;
  dependsOnStepId?: string;
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
  clarificationQuestions: string[];
  overallConfidence: number;
  requiresConfirmation: boolean;
  executionMode: ExecutionMode;
  modeReason: string;
  modeConfidence: number;
  steps: AIPlanStep[];
}
