/**
 * Declarative Validator — Evaluate validation rules against dialog state.
 *
 * Used by imported dialogs that can't carry TypeScript validate() functions.
 * Each rule is a simple predicate. Returns null if all pass, or the first error.
 */

import type { ValidationRule } from './portable-dialog-spec';

export function runValidationRules(
  rules: ValidationRule[],
  state: Record<string, unknown>
): string | null {
  for (const rule of rules) {
    const error = evaluateRule(rule, state);
    if (error) return error;
  }
  return null;
}

function evaluateRule(rule: ValidationRule, state: Record<string, unknown>): string | null {
  switch (rule.rule) {
    case 'minItems': {
      const val = state[rule.param];
      if (!Array.isArray(val) || val.length < rule.min) {
        return rule.message ?? `${rule.param} requires at least ${rule.min} items`;
      }
      return null;
    }

    case 'maxItems': {
      const val = state[rule.param];
      if (Array.isArray(val) && val.length > rule.max) {
        return rule.message ?? `${rule.param} allows at most ${rule.max} items`;
      }
      return null;
    }

    case 'range': {
      const val = Number(state[rule.param]);
      if (rule.min !== undefined && val < rule.min) {
        return rule.message ?? `${rule.param} must be at least ${rule.min}`;
      }
      if (rule.max !== undefined && val > rule.max) {
        return rule.message ?? `${rule.param} must be at most ${rule.max}`;
      }
      return null;
    }

    case 'requiredWhen': {
      const condVal = state[rule.when.param];
      if (condVal === rule.when.equals) {
        const val = state[rule.param];
        if (val === undefined || val === null || val === '') {
          return rule.message ?? `${rule.param} is required`;
        }
        if (Array.isArray(val) && val.length === 0) {
          return rule.message ?? `${rule.param} is required`;
        }
      }
      return null;
    }

    default:
      return null;
  }
}
