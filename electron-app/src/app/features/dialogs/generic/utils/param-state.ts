/**
 * Param State Utilities
 *
 * Creates Angular signals from DialogParamSchema definitions and
 * collects their current values into a plain state object.
 */

import { signal, type WritableSignal } from '@angular/core';
import type { DialogParamSchema } from '../../../../core/ai/dialog-schema.registry';

/** Returns the appropriate default value for a param kind. */
export function getDefaultValue(param: DialogParamSchema): any {
  switch (param.kind) {
    case 'boolean':
      return false;
    case 'number':
      return param.min ?? 0;
    case 'column[]':
    case 'string[]':
    case 'object[]':
      return [];
    case 'enum':
      return param.enumValues?.[0] ?? '';
    default:
      return '';
  }
}

/** Creates a WritableSignal for each param, keyed by param name. */
export function createParamSignals(
  params: DialogParamSchema[]
): Map<string, WritableSignal<any>> {
  const map = new Map<string, WritableSignal<any>>();
  for (const param of params) {
    if (param.kind === 'dataframe') continue; // handled by the shell
    map.set(param.name, signal(getDefaultValue(param)));
  }
  return map;
}

/** Reads all signals and returns a plain Record suitable for compileStepToR. */
export function collectState(
  signals: Map<string, WritableSignal<any>>,
  dataframe: string
): Record<string, unknown> {
  const state: Record<string, unknown> = { dataframe };
  for (const [name, sig] of signals) {
    const value = sig();
    if (value !== '' && value !== undefined && value !== null) {
      state[name] = value;
    }
  }
  return state;
}

/** Applies a state record to the signal map (for restore). */
export function applyState(
  signals: Map<string, WritableSignal<any>>,
  state: Record<string, unknown>
): void {
  for (const [name, value] of Object.entries(state)) {
    const sig = signals.get(name);
    if (sig && value !== undefined) {
      sig.set(value);
    }
  }
}
