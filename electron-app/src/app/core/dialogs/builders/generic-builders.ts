/**
 * Generic R Code Builders
 *
 * Three declarative builders that read an RGenDescriptor (from JSON) and
 * produce RSyntax using the existing codegen primitives.
 *
 * - function-call: wraps a single R function
 * - pipeline: dplyr pipe chain
 * - ggplot: ggplot2 layer composition
 *
 * These cover ~83% of dialogs. The remaining ~17% use custom builderIds.
 */

import { rFn, rStr, rPipe, rPlus, rSyntax, rOp, toScript } from '../../r-codegen';
import type { RSyntax as RSyntaxType } from '../../r-codegen';
import { ggBase, ggAes } from '../../r-codegen/ggplot-helpers';
import type {
  RGenDescriptor,
  RGenFunctionCall,
  RGenPipeline,
  RGenGgplot,
  RGenArg,
  WhenCondition,
} from '../../ai/generic-dialog/portable-dialog-spec';
import type { DialogParamSchema, ParamKind } from '../../ai/dialog-schema.registry';

// ── Shared Utilities ───────────────────────────────────────────────────

function buildKindMap(params: DialogParamSchema[]): Map<string, ParamKind> {
  const map = new Map<string, ParamKind>();
  for (const p of params) map.set(p.name, p.kind);
  return map;
}

/** Check if a when-condition is satisfied by the current state. */
function isConditionMet(when: WhenCondition | undefined, state: Record<string, unknown>): boolean {
  if (!when) return true;
  const val = state[when.param];
  if (when.equals !== undefined) return val === when.equals;
  // Truthy check
  if (val === undefined || val === null || val === '' || val === false) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

/** Format a value for R based on param kind. Bare values — author controls quoting in expr. */
function formatValue(value: unknown, kind: ParamKind): string {
  if (value === undefined || value === null) return '';
  switch (kind) {
    case 'boolean': return value ? 'TRUE' : 'FALSE';
    case 'column[]':
    case 'string[]': {
      const arr = Array.isArray(value) ? value : [value];
      return `c(${arr.map(v => `"${String(v)}"`).join(', ')})`;
    }
    default: return String(value);
  }
}

/** Resolve {{param}} placeholders in a string expression. */
function interpolateExpr(expr: string, state: Record<string, unknown>, kindMap: Map<string, ParamKind>): string {
  return expr.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const val = state[name];
    const kind = kindMap.get(name) ?? 'string';
    return formatValue(val, kind);
  });
}

/** Resolve an RGenArg to its R string value. Returns undefined if condition not met or value empty. */
function resolveArg(
  arg: RGenArg,
  state: Record<string, unknown>,
  kindMap: Map<string, ParamKind>
): string | undefined {
  if (!isConditionMet(arg.when, state)) return undefined;

  if (arg.expr !== undefined) {
    const resolved = interpolateExpr(arg.expr, state, kindMap);
    return resolved || undefined;
  }

  if (arg.param !== undefined) {
    const val = state[arg.param];
    if (val === undefined || val === null || val === '') return undefined;
    const kind = kindMap.get(arg.param) ?? 'string';
    return formatValue(val, kind);
  }

  if (arg.value !== undefined) {
    if (typeof arg.value === 'boolean') return arg.value ? 'TRUE' : 'FALSE';
    return String(arg.value);
  }

  return undefined;
}

// ── Function Call Builder ──────────────────────────────────────────────

function buildFromFunctionCall(
  desc: RGenFunctionCall,
  state: Record<string, unknown>,
  params: DialogParamSchema[]
): RSyntaxType {
  const kindMap = buildKindMap(params);
  const fn = desc.object ? `${desc.object}$${desc.fn}` : desc.fn;

  // Build named args, skipping those whose conditions aren't met
  const args: Record<string, string> = {};
  for (const [name, arg] of Object.entries(desc.args)) {
    const resolved = resolveArg(arg, state, kindMap);
    if (resolved !== undefined) {
      args[name] = resolved;
    }
  }

  const call = rFn(fn, args);
  let code = toScript(call);

  if (desc.assign) {
    const assignTarget = interpolateExpr(desc.assign, state, kindMap);
    code = `${assignTarget} <- ${code}`;
  }

  return rSyntax().setBase(code);
}

// ── Pipeline Builder ───────────────────────────────────────────────────

function buildFromPipeline(
  desc: RGenPipeline,
  state: Record<string, unknown>,
  params: DialogParamSchema[]
): RSyntaxType {
  const kindMap = buildKindMap(params);
  const input = interpolateExpr(desc.input, state, kindMap);

  const steps: string[] = [];
  for (const step of desc.steps) {
    if (!isConditionMet(step.when, state)) continue;

    if (step.args) {
      const args: Record<string, string> = {};
      for (const [name, arg] of Object.entries(step.args)) {
        const resolved = resolveArg(arg, state, kindMap);
        if (resolved !== undefined) {
          const argName = interpolateExpr(name, state, kindMap);
          args[argName] = resolved;
        }
      }
      steps.push(toScript(rFn(step.fn, args)));
    } else {
      steps.push(`${step.fn}()`);
    }
  }

  const pipeline = [input, ...steps].join(' %>%\n  ');

  let code = pipeline;
  if (desc.assign) {
    const assignTarget = interpolateExpr(desc.assign, state, kindMap);
    code = `${assignTarget} <- ${pipeline}`;
  }

  return rSyntax().setBase(code);
}

// ── ggplot Builder ─────────────────────────────────────────────────────

function buildFromGgplot(
  desc: RGenGgplot,
  state: Record<string, unknown>,
  params: DialogParamSchema[]
): RSyntaxType {
  const kindMap = buildKindMap(params);
  const data = interpolateExpr(desc.data, state, kindMap);

  // Resolve aesthetics — filter out empty values
  const aesMappings: Record<string, string | undefined> = {};
  for (const [key, paramRef] of Object.entries(desc.aes)) {
    const resolved = interpolateExpr(paramRef, state, kindMap);
    aesMappings[key] = resolved || undefined;
  }

  const base = ggBase(data, ggAes(aesMappings));

  // Build layers, skipping those whose conditions aren't met
  const layers: (string | undefined)[] = [base];
  for (const layer of desc.layers) {
    if (!isConditionMet(layer.when, state)) continue;

    if (layer.args) {
      const resolvedArgs: Record<string, string> = {};
      for (const [key, val] of Object.entries(layer.args)) {
        const resolved = interpolateExpr(val, state, kindMap);
        if (resolved) resolvedArgs[key] = resolved;
      }
      layers.push(toScript(rFn(layer.fn, resolvedArgs)));
    } else {
      layers.push(`${layer.fn}()`);
    }
  }

  const code = rPlus(...layers.filter(Boolean));
  return rSyntax().setBase(code);
}

// ── Dispatcher ─────────────────────────────────────────────────────────

/**
 * Build R code from a declarative RGenDescriptor.
 * Returns RSyntax that can be converted to a script string via .toScript().
 */
export function buildFromRGen(
  desc: RGenDescriptor,
  state: Record<string, unknown>,
  params: DialogParamSchema[]
): RSyntaxType | null {
  try {
    switch (desc.type) {
      case 'function-call': return buildFromFunctionCall(desc, state, params);
      case 'pipeline': return buildFromPipeline(desc, state, params);
      case 'ggplot': return buildFromGgplot(desc, state, params);
      default: return null;
    }
  } catch {
    return null;
  }
}
