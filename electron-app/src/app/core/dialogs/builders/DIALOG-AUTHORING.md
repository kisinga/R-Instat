# Writing Dialogs for R-Instat

## Quick Start

Most dialogs can be written as a single JSON file. No TypeScript needed.

Create a `.json` file with:
1. **What the dialog shows** (title, description, form fields)
2. **Which builder generates the R code** (reference by name)

```json
{
  "formatVersion": "1.0",
  "dialogId": "my-summary",
  "title": "My Summary",
  "family": "inferential",
  "description": "Summarise selected columns.",
  "operations": ["describe.summary.one_variable"],
  "params": [
    { "name": "dataframe", "kind": "dataframe", "required": true },
    { "name": "columns", "kind": "column[]", "required": true, "filter": "numeric" }
  ],
  "retrievalHints": { "keywords": ["summary", "describe"] },
  "builderId": "correlation"
}
```

That's a working dialog. The form renders automatically from `params`. The R code comes from the `correlation` builder.

---

## Where Dialogs Live

```
Simple dialogs (JSON):     src/assets/dialogs/builtin/*.json
Complex dialogs (TS):      src/app/core/ai/generic-dialog/specs/*.ts
Imported dialogs:          localStorage (via Data > Import Dialog Definition)
```

## The Two Paths

### Path 1: JSON with `builderId` (simple — 83% of dialogs)

The dialog references a shared builder by name. The builder handles R code generation.

**Use this when:** The R code structure doesn't change based on user choices — only argument values change.

**Example:** A boxplot always calls `ggplot() + geom_boxplot()`. The user picks which columns, but the code structure is the same.

```json
{
  "formatVersion": "1.0",
  "dialogId": "boxplot-generic",
  "title": "Box Plot (Generic)",
  "family": "plotting",
  "description": "Boxplot of numeric variable, optionally grouped by factor.",
  "operations": ["describe.distribution.numeric"],
  "params": [
    { "name": "dataframe", "kind": "dataframe", "required": true },
    { "name": "yVariable", "kind": "column", "required": true, "filter": "numeric" },
    { "name": "xVariable", "kind": "column", "filter": "factor" },
    { "name": "fillVariable", "kind": "column", "filter": "factor" },
    { "name": "showPoints", "kind": "boolean" }
  ],
  "retrievalHints": { "keywords": ["boxplot", "box plot", "distribution"] },
  "builderId": "boxplot"
}
```

### Path 2: TypeScript with custom builder (complex — 17% of dialogs)

The dialog has its own builder function because the R code structure changes based on user choices.

**Use this when:** Different modes produce entirely different R code, or you need iteration/conditional logic.

**Example:** Chi-square test conditionally includes `correct = FALSE` and `simulate.p.value = TRUE` arguments.

See `specs/chi-square-test.ts` for the pattern.

---

## Available Builders

### Data Manipulation
| Builder ID | R Code Pattern | Params |
|-----------|---------------|--------|
| `sort` | `dplyr::arrange()` | dataframe, sortColumns[] |
| `rename` | `dplyr::rename()` | dataframe, oldName, newName |
| `calculate` | `dplyr::mutate()` | dataframe, newColumnName, calcType, formula |
| `recode` | `dplyr::case_when()` | dataframe, sourceColumn, mappings[] |
| `duplicate-column` | `dplyr::mutate(new = old)` | dataframe, sourceColumn, newColumnName |
| `permute-column` | `dplyr::mutate(col = sample(col))` | dataframe, column |
| `delete-columns` | `dplyr::select(-cols)` | dataframe, columns[] |
| `insert-column` | `tibble::add_column()` | dataframe, columnName, columnType, position |

### Statistics
| Builder ID | R Code Pattern | Params |
|-----------|---------------|--------|
| `correlation` | `cor()` + optional p-values | dataframe, selectedVars[], method, showPValues |
| `regression` | `lm()` + summary/anova/plots | dataframe, responseVar, predictorVars[], modelName |
| `t-test` | `t.test()` (one/two/paired) | dataframe, testType, variable1, mu/groupVar/variable2 |

### Graphs
| Builder ID | R Code Pattern | Params |
|-----------|---------------|--------|
| `histogram` | `ggplot() + geom_histogram()` | dataframe, variable, bins, fillColor, facetBy |
| `boxplot` | `ggplot() + geom_boxplot()` | dataframe, yVariable, xVariable, fillVariable |
| `scatter` | `ggplot() + geom_point()` | dataframe, xVariable, yVariable, colorVariable |
| `bar-chart` | `ggplot() + geom_bar()` | dataframe, xVariable, yVariable, chartType |

### Custom (complex dialogs only)
| Builder ID | Why custom |
|-----------|-----------|
| `chi-square-test` | Conditional args (correct, simulate) |
| `frequency-table` | Conditional `addmargins()` wrapping |
| `row-summary` | rowwise pipeline with dynamic function |
| `convert-columns` | Per-column iteration with type lookup |
| `one-variable-summarise` | 3 entirely different R code paths |

---

## Param Schema Reference

Each param in the `params` array defines a form field.

### Param Kinds

| Kind | Form Control | R Value |
|------|-------------|---------|
| `dataframe` | Dataframe dropdown | Bare name: `mydata` |
| `column` | Column picker (single) | Column name: `age` |
| `column[]` | Column picker (multi) | Array: `c("a", "b")` |
| `enum` | Dropdown select | Selected value |
| `boolean` | Checkbox | `TRUE` / `FALSE` |
| `number` | Number input | Bare number: `30` |
| `string` | Text input | Text value |
| `string[]` | Multi-text | Array: `c("x", "y")` |
| `checklist` | Categorized checkbox list | Selected keys |

### Param Options

```json
{
  "name": "variable",
  "kind": "column",
  "required": true,
  "filter": "numeric",
  "label": "Select Variable",
  "default": "height",
  "group": "Options",
  "when": { "param": "mode", "equals": "advanced" }
}
```

| Field | Purpose |
|-------|---------|
| `name` | Param identifier (must match builder's expected state key) |
| `kind` | Type of form control |
| `required` | Validation: must be filled |
| `filter` | Column type filter: `numeric`, `factor`, `date`, `any` |
| `label` | Display label (defaults to humanized `name`) |
| `default` | Initial value |
| `group` | Groups params under a collapsible heading |
| `when` | Conditional visibility: show only when another param has a specific value |
| `enumValues` | Options for `enum` kind |
| `options` | Options for `checklist` kind (array of `{ key, label, category? }`) |
| `min`, `max` | Range constraints for `number` kind |

---

## Validation Rules

Declarative validation for JSON specs. TypeScript specs use `validate()` functions.

```json
"validations": [
  { "rule": "minItems", "param": "columns", "min": 2, "message": "Select at least 2" },
  { "rule": "maxItems", "param": "columns", "max": 10 },
  { "rule": "range", "param": "bins", "min": 1, "max": 500 },
  { "rule": "requiredWhen", "param": "groupVar", "when": { "param": "testType", "equals": "two" }, "message": "Required for two-sample" }
]
```

---

## Sharing Dialogs

### Export
Generic dialogs with `builderId` show an **Export** button. The exported `.rinstat-dialog.json` file contains everything needed for another user to import and use the dialog.

### Import
**Data menu → Import Dialog Definition** → select a `.rinstat-dialog.json` file. The dialog appears immediately in the **Imported Dialogs** toolbar menu and persists across restarts.

### Self-Contained R Scripts
When a dialog generates R code, metadata is embedded as comments. If the dialog is imported (not built-in), the full definition is also embedded. Recipients can paste the R code into **Restore From Code** and the dialog auto-imports.

---

## When to Use a Custom Builder

You need a TypeScript builder when:

1. **The R function changes based on state** — e.g., `as.factor()` vs `as.numeric()` vs `as.Date()` depending on a dropdown
2. **Multiple independent R statements** — e.g., regression producing model + summary + anova as separate outputs
3. **Iteration** — e.g., applying a conversion to each selected column separately
4. **Complex conditional sections** — e.g., only adding `simulate.p.value = TRUE, B = 5000` when a checkbox is checked

If the R code is always "call function X with these arguments," use a JSON spec with `builderId`.

---

## Registering a New Builder

In the appropriate builder file (`data-manipulation.ts`, `statistics.ts`, `graphs.ts`, or `barchart.ts`):

```typescript
import { registerBuilder } from './builder-registry';

registerBuilder('my-analysis', (state) => {
  const df = String(state['dataframe']);
  const col = String(state['column']);
  // Use rFn, rPipe, rSyntax from r-codegen
  return rSyntax().setBase(`my_function(${df}$${col})`);
});
```

Then reference it from a JSON spec with `"builderId": "my-analysis"`.

---

## File Locations

```
Builder registry:       core/dialogs/builders/builder-registry.ts
Builder files:          core/dialogs/builders/{data-manipulation,statistics,graphs,barchart}.ts
Generic builder engine: core/dialogs/builders/generic-builders.ts
JSON spec loader:       core/ai/generic-dialog/builtin-json-specs.ts
TS spec barrel:         core/ai/generic-dialog/specs/index.ts
Portable spec types:    core/ai/generic-dialog/portable-dialog-spec.ts
Step compiler:          core/ai/step-to-r.ts
Dialog library:         core/services/dialog-library.service.ts
Generic renderer:       features/dialogs/generic/generic-dialog.component.ts
```
