/**
 * Pure formatters for AI Assist UI (percent, step labels, state/code summaries).
 * Shared by the dialog and plan-result subcomponent.
 */

import type { ResolvedPlanStep } from '../../../core/services/intent-resolver.service';

export function toPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function stepLabel(step: ResolvedPlanStep): string {
  if (step.kind === 'dialog' && step.metadata) {
    return step.metadata.dialogId;
  }
  return 'R code step';
}

export function summarizeState(state: Record<string, unknown>): string {
  const parts = Object.entries(state)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
      return `${k}: ${v}`;
    });
  return parts.slice(0, 6).join('; ') + (parts.length > 6 ? '...' : '');
}

export function summarizeCode(script: string): string {
  return script.replace(/\s+/g, ' ').trim().slice(0, 160);
}
