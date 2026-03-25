/**
 * Pipeline stage interface with typed StageResult.
 *
 * Replaces the old boolean return + context mutation pattern with
 * a discriminated union that explicitly declares intent:
 * - continue: stage completed, proceed to next
 * - terminate: early exit with a result (replaces earlyResult + return false)
 * - skip-remaining: skip all remaining stages, use result mapper
 */

import type { PipelineContext } from './context';
import type { AICallResult } from '../types/ai-result.types';

export type StageErrorPolicy = 'silent' | 'warn' | 'fatal';

/** Discriminated union — stages declare their intent explicitly */
export type StageResult =
  | { action: 'continue' }
  | { action: 'terminate'; result: AICallResult }
  | { action: 'skip-remaining' };

export interface PipelineStage {
  readonly id: string;
  readonly errorPolicy: StageErrorPolicy;
  execute(ctx: PipelineContext): Promise<StageResult>;
}

/** Helper to create StageResult values concisely */
export const Stage = {
  continue: (): StageResult => ({ action: 'continue' }),
  terminate: (result: AICallResult): StageResult => ({ action: 'terminate', result }),
  skipRemaining: (): StageResult => ({ action: 'skip-remaining' }),
} as const;
