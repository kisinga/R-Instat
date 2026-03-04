# Bar Chart Parity Contract (Core Perfection)

## Scope

- Legacy: `instat/dlgBarAndPieChart.vb`
- Ported: `electron-app/src/app/features/dialogs/bar-chart/bar-chart-dialog.component.ts`
- Builder: `electron-app/src/app/core/dialogs/builders/barchart.ts`
- Schema: `electron-app/src/app/core/ai/dialog-schema.registry.ts`

## Dataset Mapping

| Legacy Concept | Ported Concept | Status | Notes |
|---|---|---|---|
| Active dataframe and selectable dataframe list | `DialogBase.selectedDataframe` + `dataframes()` | Equivalent | Same user outcome; implementation differs |
| X variable must be categorical | `getFactorColumns()` for `xVariable` | Exact | |
| Y variable for value chart must be numeric | `getNumericColumns()` with conditional UI | Exact | Added in pilot |
| Fill/group variable categorical | `getFactorColumns()` for `fillVariable` | Exact | |

## Option Mapping

| Option | Legacy Behavior | Ported Behavior | Status | Disposition |
|---|---|---|---|---|
| Chart mode: Frequency | Available | Available | Exact | |
| Chart mode: Value | Available | Available | Exact | Added in pilot |
| Position: Stack/Dodge/Fill | Available | Available | Exact | |
| Horizontal orientation (coord flip) | Available | Available | Exact | Uses `horizontal` option passed to builder |
| Custom title | Available via options | Available (`title`) | Exact | |
| Output name/assignment | Available (`ucrSaveBar`) | Available (`outputName`) | Exact | |
| Position: Jitter/Reverse variants | Available | Not exposed | Missing | Deferred until builder parity expansion |
| Treemap mode | Available | Not exposed | Missing | Deferred (new builder/UI path required) |
| Wordcloud mode | Available | Not exposed | Missing | Deferred (new builder/UI path required) |
| Advanced sub-dialog options (layer/plot/text options) | Available | Not exposed | Missing | Deferred; requires secondary options framework |

## Flow Mapping

| Flow Step | Legacy Behavior | Ported Behavior | Status | Notes |
|---|---|---|---|---|
| Initialization | Complex control wiring and defaults | Signal initialization + form registry + code manager | Equivalent | |
| Dynamic field visibility | Linked controls by mode | Angular conditional rendering (`@if chartType()`, `@if fillVariable()`) | Equivalent | Includes mode and fill-sensitive sections |
| Validation | Mode-specific checks | `isValid()` includes conditional Y requirement for value mode | Exact | |
| R code generation | `RFunction/ROperator` graph composition | Builder dispatch (`frequency` vs `value`) | Equivalent | |
| Execute/save/restore | `ucrBase` lifecycle | `DialogBase.execute()` + metadata/prefs | Equivalent | |

## Core Regression Evidence

- Builder regression matrix and metadata roundtrip:
  - `electron-app/src/app/core/dialogs/builders/barchart.spec.ts`
- AI contract consistency + bar specific resolver normalization:
  - `electron-app/src/app/core/ai/dialog-contract.integration.spec.ts`
- Bar dialog deterministic dataframe transition handling:
  - `electron-app/src/app/features/dialogs/bar-chart/bar-chart-dialog.component.ts`

## AI Contract Alignment

- Added `chartType` enum to schema (`frequency`, `value`).
- Added conditional required `yVariable` when `chartType = value`.
- Added optional `title` and `outputName` in schema.
- Added `bar-chart` to relevant operation mappings for planner compatibility.

## Intentional Staging (Approved For Pilot)

The pilot targets no regression for core bar chart workflows (frequency + value) and contract consistency. Advanced legacy families are staged for later waves:

- Treemap and wordcloud chart families
- Reverse/jitter position variants
- Secondary option dialogs for plot/layer/text fine-tuning

These remain in the gap ledger as `Missing`, intentionally out of this core-perfection scope, and tracked in rollout scorecards.
