/**
 * Builder Registry — First-class registry for R code builders.
 *
 * Builders are functions that take dialog state and produce RSyntax.
 * Dialogs reference builders by ID via the `builderId` field.
 * The switch-case in compileStepToR is replaced by a registry lookup.
 */

import type { RSyntax } from '../../r-codegen';

export type BuilderFn = (state: Record<string, unknown>) => RSyntax;

const registry = new Map<string, BuilderFn>();

export function registerBuilder(id: string, fn: BuilderFn): void {
  if (registry.has(id)) {
    console.warn(`[BuilderRegistry] Duplicate builder: "${id}"`);
  }
  registry.set(id, fn);
}

export function getBuilder(id: string): BuilderFn | undefined {
  return registry.get(id);
}

export function hasBuilder(id: string): boolean {
  return registry.has(id);
}

export function listBuilderIds(): string[] {
  return [...registry.keys()];
}
