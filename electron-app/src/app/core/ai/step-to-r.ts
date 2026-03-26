/**
 * Step-to-R compiler
 *
 * Single entry point for R code generation. Handles the full resolution chain:
 *   1. builderId → builder registry (custom TypeScript builders)
 *   2. rGen → generic builder (function-call, pipeline, ggplot)
 *   3. rCode → string interpolation (escape hatch)
 *
 * No caller needs to know which path produced the code.
 */

import { getBuilder } from '../dialogs/builders/builder-registry';
import { buildFromRGen } from '../dialogs/builders/generic-builders';
import { interpolateRCode } from './generic-dialog/r-code-interpolator';
import { getCatalogContract } from './dialog-catalog-aggregator';
import type { RGenDescriptor } from './generic-dialog/portable-dialog-spec';
import type { DialogParamSchema } from './dialog-schema.registry';

// Ensure all builder registrations execute
import '../dialogs/builders/data-manipulation';
import '../dialogs/builders/statistics';
import '../dialogs/builders/graphs';
import '../dialogs/builders/barchart';

/**
 * Everything needed to resolve R code generation for a step.
 * Can come from a DialogContract, a PortableDialogSpec, or an AI plan step.
 */
export interface StepCodegenInfo {
  builderId?: string;
  rGen?: RGenDescriptor;
  rCode?: string;
  params?: DialogParamSchema[];
}

/**
 * Compile a step to R code.
 *
 * Resolution chain:
 *   1. builderId → builder registry
 *   2. rGen → generic builder (function-call / pipeline / ggplot)
 *   3. rCode → string interpolation
 *
 * @param info - Codegen info (builderId, rGen, rCode, params)
 * @param state - Dialog state (param values)
 */
export function compileStep(info: StepCodegenInfo, state: Record<string, unknown>): string | null {
  // 1. Custom builder from registry
  if (info.builderId) {
    const builder = getBuilder(info.builderId);
    if (builder) {
      try {
        const script = builder(state).toScript();
        return script?.trim() || null;
      } catch { /* fall through */ }
    }
  }

  // 2. Generic builder from rGen descriptor
  if (info.rGen && info.params) {
    try {
      const syntax = buildFromRGen(info.rGen, state, info.params);
      const script = syntax?.toScript();
      if (script?.trim()) return script.trim();
    } catch { /* fall through */ }
  }

  // 3. String interpolation from rCode
  if (info.rCode && info.params) {
    try {
      return interpolateRCode(info.rCode, state, info.params);
    } catch { /* fall through */ }
  }

  return null;
}

/**
 * Compile a step using a dialogId to look up codegen info from the catalog.
 * Used by callers that only have a dialogId (e.g. AI plan steps).
 */
export function compileStepByDialogId(dialogId: string, state: Record<string, unknown>): string | null {
  // Try dialogId directly as builderId (works when they match, e.g. 'sort', 'histogram')
  const direct = getBuilder(dialogId);
  if (direct) {
    try {
      const script = direct(state).toScript();
      return script?.trim() || null;
    } catch { /* fall through */ }
  }

  // Look up the contract from the catalog
  const contract = getCatalogContract(dialogId);
  if (!contract) return null;

  return compileStep(
    { builderId: contract.builderId, params: contract.params },
    state
  );
}
