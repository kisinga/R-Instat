/**
 * Zod schemas for the AI plan structure.
 *
 * Single source of truth — TypeScript types are inferred from these schemas.
 * Used by Instructor.js in the Electron main process for validated extraction,
 * and by the renderer via type-only imports.
 */

import { z } from 'zod';

export const ClarificationItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('choice'),
    options: z.array(z.string().min(1)).min(2).max(5),
  }),
  z.object({
    kind: z.literal('question'),
    text: z.string().min(1),
  }),
]);

export const PlanStepSchema = z.object({
  stepId: z.string(),
  stepType: z.enum(['dialog', 'code']).optional(),
  operationId: z.string().optional(),
  dialogId: z.string().optional(),
  dependsOnStepId: z.string().nullable().optional(),
  state: z.record(z.unknown()).optional(),
  inferredFields: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
  executionMode: z.enum(['structured_codegen', 'direct_r']).optional(),
  script: z.string().optional(),
  expectedOutputs: z.array(z.string()).optional(),
  safetyFlags: z.array(z.string()).optional(),
});

export const PlanSchema = z.object({
  goal: z.string(),
  assumptions: z.array(z.string()),
  clarifications: z.array(ClarificationItemSchema).max(3),
  overallConfidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean(),
  executionMode: z.string(),
  modeReason: z.string(),
  modeConfidence: z.number().min(0).max(1),
  steps: z.array(PlanStepSchema),
});

/** Inferred types — use these everywhere instead of hand-maintained interfaces */
export type AIPlanFromSchema = z.infer<typeof PlanSchema>;
export type AIPlanStepFromSchema = z.infer<typeof PlanStepSchema>;
export type ClarificationItem = z.infer<typeof ClarificationItemSchema>;
