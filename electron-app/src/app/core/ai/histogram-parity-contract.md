# Histogram Parity Contract (Wave 1)

## Scope

- Legacy: `instat/dlgHistogram.vb` (and `dlgHistogramMethod.vb` for method-specific options)
- Ported: `electron-app/src/app/features/dialogs/histogram/histogram-dialog.component.ts`
- Builder: `electron-app/src/app/core/dialogs/builders/graphs.ts` (`buildHistogram`)
- Schema: `electron-app/src/app/core/ai/dialog-schema.registry.ts`

## Dataset Mapping

| Legacy Concept | Ported Concept | Status | Notes |
|---|---|---|---|
| Active dataframe / selectable dataframe list | `DialogBase.selectedDataframe` + `dataframes()` | Equivalent | Same outcome via Angular signals |
| Primary variable must be numeric | `getNumericColumns()` for `variable` | Exact | |
| Optional facet/group variable categorical | `getFactorColumns()` for `facetBy` | Exact | |

## Option Mapping

| Option | Legacy Behavior | Ported Behavior | Status | Disposition |
|---|---|---|---|---|
| Numeric variable selection | Required | Required | Exact | |
| Bins control | Available | Available (`bins`) | Exact | Validation now enforces 5..100 |
| Fill color | Available (varies by method) | Available (`fillColor`) | Equivalent | Simplified UI but equivalent basic capability |
| Faceting | Available | Available (`facetBy`) | Equivalent | |
| Custom title | Available via labels/options | Available (`title`) | Equivalent | Added in Wave 1 |
| Output graph assignment name | Available via save control | Available (`outputName`) | Equivalent | Added in Wave 1 |
| Density/frequency polygon/ridges modes | Available | Not exposed | Missing | Deferred to advanced histogram parity phase |
| Binwidth mode and advanced legend/theming controls | Available | Not exposed | Missing | Deferred to advanced options framework |

## Flow Mapping

| Flow Step | Legacy Behavior | Ported Behavior | Status | Notes |
|---|---|---|---|---|
| Initialize controls/defaults | Form/control init and defaults | Signal init + `DialogBase` defaults/restore | Equivalent | |
| Dynamic enable/disable | Extensive UI linking | Simpler direct form with required/optional fields | Equivalent | Core flow preserved |
| Validation | Variable plus method-specific checks | `isValid()` checks dataframe/variable/bins bounds | Equivalent | |
| R code generation | Complex function/operator composition | Builder-based `buildHistogram` | Equivalent | |
| Execute/save/restore | `ucrBase` lifecycle | `DialogBase.execute()` + field registry + metadata | Equivalent | |

## AI Contract Alignment

- Schema now includes optional `title` and `outputName` to match UI and builder.
- Existing schema constraints for `variable`, `bins`, and `facetBy` retained.
- Operation mapping already aligned (`describe.distribution.numeric` -> `histogram`).

## Staged Gaps

The following legacy capabilities are intentionally staged for a later hardening pass:

- Histogram mode families: density, frequency polygon, ridges
- Advanced controls around legend/theming/binwidth behaviors

These remain explicit `Missing` entries to prevent silent regressions in roadmap planning.
