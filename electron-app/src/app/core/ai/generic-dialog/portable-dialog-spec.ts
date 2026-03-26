/**
 * Portable Dialog Spec — Fully JSON-serializable dialog definition.
 *
 * File format for .rinstat-dialog.json files.
 * Converted to a DialogContract via portableSpecToContract() before registration.
 *
 * R code generation uses one of three approaches (pick one):
 *   1. rGen   — declarative R code description (function-call, pipeline, or ggplot)
 *   2. builderId — reference to a custom TypeScript builder in the registry
 *   3. rCode  — raw R string with {{param}} placeholders (escape hatch)
 */

import type { DialogFamily } from '../dialog-catalog';
import type { DialogParamSchema } from '../dialog-schema.registry';

// ── Validation Rules ───────────────────────────────────────────────────

export type ValidationRule =
  | { rule: 'minItems'; param: string; min: number; message?: string }
  | { rule: 'maxItems'; param: string; max: number; message?: string }
  | { rule: 'range'; param: string; min?: number; max?: number; message?: string }
  | {
      rule: 'requiredWhen';
      param: string;
      when: { param: string; equals: unknown };
      message?: string;
    };

// ── R Code Generation Descriptors ──────────────────────────────────────

/**
 * Conditional inclusion. When present on an arg/step/layer,
 * the element is only included if the condition is met.
 *
 * - `{ param: "simulate" }` — include if param is truthy
 * - `{ param: "simulate", equals: true }` — include if param equals value
 */
export interface WhenCondition {
  param: string;
  equals?: unknown;
}

/**
 * A single argument in an R function call.
 *
 * Exactly one of `param`, `expr`, or `value` should be set:
 * - `param`: resolves the value from dialog state, formatted by param kind
 * - `expr`: literal R expression, may contain {{param}} refs for interpolation
 * - `value`: static value (string/number/boolean)
 *
 * @example
 * // From state: { "correct": { "param": "correct" } }
 * // Static:     { "alpha": { "value": 0.8 } }
 * // Expression: { "x": { "expr": "table(get_dataframe(\"{{dataframe}}\")[, c({{columns}})])" } }
 * // Conditional: { "B": { "param": "replicates", "when": { "param": "simulate", "equals": true } } }
 */
export interface RGenArg {
  param?: string;
  expr?: string;
  value?: string | number | boolean;
  when?: WhenCondition;
}

/**
 * Call a single R function with named arguments.
 *
 * @example JSON producing `chisq.test(table(...), correct = TRUE, simulate.p.value = FALSE)`
 * ```json
 * {
 *   "type": "function-call",
 *   "fn": "chisq.test",
 *   "args": {
 *     "x": { "expr": "table(get_dataframe(\"{{dataframe}}\")[, c({{columns}})])" },
 *     "correct": { "param": "correct" },
 *     "simulate.p.value": { "param": "simulate" },
 *     "B": { "param": "replicates", "when": { "param": "simulate", "equals": true } }
 *   }
 * }
 * ```
 */
export interface RGenFunctionCall {
  type: 'function-call';
  /** R function name (e.g. "chisq.test", "cor", "t.test") */
  fn: string;
  /** If set, generates a method call: object$fn() (e.g. "data_book") */
  object?: string;
  /** Named arguments */
  args: Record<string, RGenArg>;
  /** Assign result to a variable (e.g. "model") */
  assign?: string;
}

/**
 * A step in a dplyr-style pipe chain.
 */
export interface RGenPipeStep {
  /** Function name (e.g. "dplyr::mutate", "dplyr::arrange") */
  fn: string;
  /** Named arguments */
  args?: Record<string, RGenArg>;
  /** Conditional inclusion */
  when?: WhenCondition;
}

/**
 * Chain R functions with %>% pipe operator.
 *
 * @example JSON producing `df %>% dplyr::arrange(desc(year)) %>% add_dataframe(name = "df")`
 * ```json
 * {
 *   "type": "pipeline",
 *   "input": "get_dataframe(\"{{dataframe}}\")",
 *   "steps": [
 *     { "fn": "dplyr::arrange", "args": { "": { "expr": "desc({{sortColumn}})" } } },
 *     { "fn": "add_dataframe", "args": { "name": { "param": "dataframe" } } }
 *   ],
 *   "assign": "{{dataframe}}"
 * }
 * ```
 */
export interface RGenPipeline {
  type: 'pipeline';
  /** Starting expression (e.g. "get_dataframe(\"{{dataframe}}\")") */
  input: string;
  /** Pipe steps chained with %>% */
  steps: RGenPipeStep[];
  /** Assign result to a variable */
  assign?: string;
}

/**
 * A ggplot layer (geom, facet, theme, labs, scale, etc.)
 */
export interface RGenLayer {
  /** Function name (e.g. "geom_histogram", "facet_wrap", "theme_minimal") */
  fn: string;
  /** Simple string arguments — values may contain {{param}} refs */
  args?: Record<string, string>;
  /** Conditional inclusion */
  when?: WhenCondition;
}

/**
 * Compose ggplot2 layers with + operator.
 *
 * @example JSON producing `ggplot(data, aes(x = var)) + geom_histogram(bins = 30) + theme_minimal()`
 * ```json
 * {
 *   "type": "ggplot",
 *   "data": "get_dataframe(\"{{dataframe}}\")",
 *   "aes": { "x": "{{variable}}" },
 *   "layers": [
 *     { "fn": "geom_histogram", "args": { "bins": "{{bins}}", "alpha": "0.8" } },
 *     { "fn": "facet_wrap", "args": { "facets": "~{{facetBy}}" }, "when": { "param": "facetBy" } },
 *     { "fn": "theme_minimal" },
 *     { "fn": "labs", "args": { "title": "{{title}}", "x": "{{variable}}", "y": "Count" } }
 *   ]
 * }
 * ```
 */
export interface RGenGgplot {
  type: 'ggplot';
  /** Data expression */
  data: string;
  /** Aesthetic mappings — values are {{param}} refs resolved to column names */
  aes: Record<string, string>;
  /** Layers composed with + */
  layers: RGenLayer[];
}

/** Discriminated union of the three R code generation approaches. */
export type RGenDescriptor =
  | RGenFunctionCall
  | RGenPipeline
  | RGenGgplot;

// ── Portable Dialog Spec ───────────────────────────────────────────────

export interface PortableDialogSpec {
  /** Format version for forward compatibility */
  formatVersion: '1.0';

  /** Unique dialog identifier (lowercase, hyphens, e.g. "my-custom-test") */
  dialogId: string;

  /** Human-readable title */
  title: string;

  /** Dialog family for categorization and AI retrieval */
  family: DialogFamily;

  /** Natural language description of what this dialog does */
  description: string;

  /** Operation taxonomy identifiers (e.g. "test.independence.factor_factor") */
  operations: string[];

  /** Parameter definitions — drives form rendering and AI grounding */
  params: DialogParamSchema[];

  /** Keywords for AI retrieval scoring */
  retrievalHints: { keywords: string[] };

  /** Declarative validation rules (optional) */
  validations?: ValidationRule[];

  /**
   * Declarative R code generation (covers 83% of dialogs).
   * Pick the type that matches your R code pattern:
   * - "function-call": wraps a single R function
   * - "pipeline": dplyr pipe chain
   * - "ggplot": ggplot2 layer composition
   */
  rGen?: RGenDescriptor;

  /** Reference to a custom TypeScript builder (for complex 17% of dialogs) */
  builderId?: string;

  /** Raw R code with {{param}} placeholders (escape hatch) */
  rCode?: string;

  /** Optional pre-filled values for sharing configured dialogs */
  defaultState?: Record<string, unknown>;

  /** Optional metadata about authorship and origin */
  meta?: {
    author?: string;
    version?: string;
    createdAt?: string;
    source?: string;
  };
}
