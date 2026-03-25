/**
 * Param Visibility Evaluator
 *
 * Evaluates `when` conditions on DialogParamSchema to determine
 * whether a field should be visible in the generic dialog form.
 */

import type { WritableSignal } from '@angular/core';
import type { DialogParamSchema } from '../../../../core/ai/dialog-schema.registry';

/**
 * Returns true if the param should be visible given the current state.
 * A param without a `when` condition is always visible.
 */
export function isParamVisible(
  param: DialogParamSchema,
  state: Map<string, WritableSignal<any>>
): boolean {
  if (!param.when) return true;

  const dependencySignal = state.get(param.when.param);
  if (!dependencySignal) return true; // dependency not found — show by default

  return dependencySignal() === param.when.equals;
}
