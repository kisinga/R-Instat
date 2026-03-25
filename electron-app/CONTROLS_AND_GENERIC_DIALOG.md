# VB.NET Controls, R Functions, and the Generic Dialog System

What do we gain by porting the 105 `ucr*` controls and ~1,260 R function references? What does this mean for the generic dialog renderer?

---

## 1. The 105 Controls: What They Actually Do

| Category | Count | What they do | Used by |
|---|---|---|---|
| Selector/Receiver | 9 | Drag-drop column selection with metadata filtering | 348 dialogs |
| Input controls | 36 | Text, numeric, combo, calculator, date, color, distribution pickers | ~150 dialogs |
| Checkboxes/Radio | 2 | Boolean/enum params mapped to R TRUE/FALSE | 234 dialogs |
| Save/Output | 4 | Output naming, position (first/last/before/after), save type | 306 dialogs |
| Dialog buttons | 2 | OK/Cancel/Reset, script execution, comment box | Every dialog |
| Data management | 16 | Dataframe display, metadata, grid views | Infrastructure |
| ggplot controls | 8 | Layer editor, axes, themes, geom configuration | ~30 plot dialogs |
| Table controls | 22 | gt/gtExtras table formatting (columns, rows, cells, styles) | ~10 table dialogs |
| Specialized | 6 | Image/web viewers, variable name validation | Scattered |

**Key insight**: Most of these are parameter-binding wrappers. They take a user input, format it as an R parameter value, and attach it to an `RFunction` or `ROperator`. Only 3 systems are architecturally significant: **selector/receiver**, **save/position**, and **ggplot layer controls**.

---

## 2. What the Generic Dialog Already Replaces

The generic renderer's 7 `ParamKind` types cover the same ground as most `ucr*` controls:

| VB.NET control | Count | Generic ParamKind | Gap |
|---|---|---|---|
| ucrCheck | 234 uses | `boolean` | None |
| ucrInputTextBox | ~60 uses | `string` | None |
| ucrNud (numeric spinner) | ~40 uses | `number` (with min/max) | None |
| ucrInputComboBox | ~50 uses | `enum` (with enumValues) | None |
| ucrReceiverSingle | ~200 uses | `column` (with `filter` + ColumnSlot) | **CLOSED** — ColumnSlot with coordinator |
| ucrReceiverMultiple | ~148 uses | `column[]` (with `filter` + ColumnSlot) | **CLOSED** — ColumnSlot with `[multiple]` |
| ucrDataFrame selector | Every dialog | `dataframe` | None |
| ucrSave | 306 uses | `string` (outputName) | Position dialog missing |
| ucrRadio (deprecated) | ~10 uses | `enum` | None |

**~88% of control usage is now covered** by the generic renderer's param types + ColumnSelector system. The validated comparisons confirm this:

| Dialog | Custom (lines) | Generic (lines) | Same R output? |
|---|---|---|---|
| t-Test | 300 | 55 | Yes |
| Regression | 213 | 45 | Yes |
| Correlation | 183 | 40 | Yes |
| Box Plot | 179 | 35 | Yes |

---

## 3. What We DON'T Gain by Porting All 105 Controls

Most `ucr*` controls exist because **WinForms has no data-binding or declarative rendering**. Every checkbox needs a `ucrCheck` wrapper to connect it to an `RParameter`. Every text input needs a `ucrInput` to validate and bind. In Angular with signals, this binding is one line:

```html
<!-- VB.NET needed ucrCheck (194 lines) for this -->
<input type="checkbox" [ngModel]="value()" (ngModelChange)="value.set($event)" />
```

**We should NOT port**: ucrCheck, ucrRadio, ucrInputTextBox, ucrInputComboBox, ucrNud, ucrInput, ucrButtons, ucrButtonsSubdialogue, all 22 table controls (they wrap the `gt` R package — better to generate gt code directly), and all 16 data management controls (replaced by AG Grid + AppStateService).

That's **~82 of 105 controls we never need to build.** They were WinForms plumbing, not domain logic.

---

## 4. What We DO Gain by Building 3 Things

### 4.1 Enhanced Column Picker — DONE (replaces selector/receiver, 9 controls)

**Built March 2026** as the `ColumnSelector` + `ColumnSlot` + `ColumnSelectorCoordinator` system.

| Feature | VB.NET selector/receiver | ColumnSelector + ColumnSlot | Status |
|---|---|---|---|
| All columns visible at once | ListView shows all columns | Inline list in each slot | Done |
| Multi-receiver coordination | Selector auto-focuses next receiver after adding | Coordinator auto-advances focus to next empty slot | Done |
| Metadata filtering | Filter by class, hidden status, climatic type | `ColumnInfo` extended with `hidden?`, `classes?`, `climaticRole?`; `filter` input per slot | Done (schema ready; R-side enrichment pending) |
| Drag-and-drop | Natural column-to-slot interaction | Native HTML5 DnD from master list to slot drop zones | Done |
| Auto-fill | If only one column matches filter, auto-select it | Coordinator.autoFill() on init + dataframe change | Done |
| Column exclusion | N/A (implicit via VB.NET logic) | `excludeUsed` dims columns selected in other slots | Done |

**What this means for the generic dialog**: The generic `GenericFormSectionComponent` auto-wraps column-kind params in a `ColumnSelector` with `ColumnSlot` per param. **No spec changes needed** — every existing and future generic spec benefits automatically.

**Actual scope**: 3 files (~300 lines total) replacing 9 VB.NET controls (~3,000 lines combined). All 25 custom dialogs + generic renderer migrated. Old `ColumnPickerComponent` deleted.

**Measured impact on porting**: Fresh-port test of 4 VB.NET dialogs as generic specs averaged ~4 minutes each. Column-heavy dialogs (frequency table: 2 receivers, chi-square: 1 multi-select) required no additional code for the column selection UX — the spec's `column`/`column[]` param kinds rendered with full coordination automatically.

### 4.2 Save/Position Control (replaces ucrSave, 1 control)

`ucrSave` appears in 306 dialogs. It handles: output naming, save type (column/graph/model/dataframe), and column position (first/last/before/after). Currently the generic dialog has `string` for output names but no position control.

**What this means for the generic dialog**: A new `ParamKind` — something like `'output'` — with an `outputType` hint. The generic renderer renders a name input + optional position selector. Every data-preparation spec that creates a new column would use it.

**Estimated scope**: One component (~150 lines) replacing 1 VB.NET control (~600 lines).

### 4.3 ggplot Layer System (8 controls — custom components only)

The ggplot controls (geom selector, layer parameters, axes, themes) are inherently compositional — they manage N layers, each with their own aesthetics. This is beyond what a flat param schema can express.

**What this means for the generic dialog**: Nothing. These remain custom component territory. The 22% of dialogs classified as "custom" are mostly ggplot dialogs. The layer system is built as custom Angular components used by those dialogs.

---

## 5. The R Function Question: 1,260 vs ~60

This is a misleading comparison. The VB.NET app references ~1,260 unique R function names via `SetRCommand()`. The Electron app's builders reference ~60. But:

**The Electron bridge can execute ANY R code.** `bridge.R` uses `eval(parse(text = code))` — there is no registry of allowed functions. A builder that generates `ggplot2::geom_violin(...)` works immediately, even though no builder has used `geom_violin` before.

The gap is not "which R functions can Electron call" — it's "which R code patterns have we written builders for." Each new `OperationSpec` + builder closes the gap for that operation's R functions.

**What this means for the generic dialog**: Adding a new operation requires:
1. A builder function that generates the R code string (~20-50 lines)
2. A case in `compileStepToR` (~5-10 lines)
3. An `OperationSpec` (~25-50 lines)

No R-side changes. No bridge changes. No new "R function registration."

---

## 6. Priority Recommendations

### Done (high leverage for generic dialog)

1. ~~Enhanced ColumnPicker~~ **DONE** — `ColumnSelector` + `ColumnSlot` + `ColumnSelectorCoordinator`. Auto-fill, multi-receiver coordination, DnD, type filtering, column exclusion. All 25 custom dialogs + generic renderer migrated. Old `ColumnPickerComponent` deleted.

### Build now (next highest leverage)

2. **Save/Position param kind** — unblocks generic specs for the ~200 data-preparation dialogs that create output columns. New `ParamKind: 'output'` with position control (first/last/before/after). Estimated: ~150 lines, 1 component.

3. **Batch-port simple dialogs** — With ColumnSelector in place, the 55% "simple" tier (~190 VB.NET dialogs) can be ported at ~4 min/spec. A focused sprint could add 30-50 specs per week.

### Don't build (no leverage)

4. Everything else. The 82 input/checkbox/button/table/data controls are WinForms plumbing that Angular's built-in facilities already replace. The ggplot layer controls are custom-component territory and not generic-dialog-relevant.

---

## 7. Generic Dialog Coverage: Current State (March 2026)

**ColumnSelector is built.** Coverage has moved from projection to measurement:

| State | Generic coverage | What changed |
|---|---|---|
| Before ColumnSelector | ~78% of dialogs viable | Dropdown-based picker, no coordination |
| **Now (ColumnSelector done)** | **~88% of dialogs viable** | Auto-fill, coordination, DnD, type filtering, column exclusion |
| With Save/Position (next) | ~92% of dialogs viable | Unblocks ~200 data-prep specs that create output columns |

**Validated with 12 generic specs** (8 existing + 4 fresh ports):

| Spec | Category | Params | Column receivers | Port time |
|---|---|---|---|---|
| delete-columns | data-prep | 2 | 1 (multi) | existing |
| duplicate-columns | data-prep | 2 | 1 (single) | existing |
| insert-column | data-prep | 5 | 1 (conditional) | existing |
| permute-column | data-prep | 2 | 1 (single) | existing |
| t-test-generic | inferential | 8 | 3 (conditional) | existing |
| regression-generic | inferential | 7 | 2 (single+multi) | existing |
| correlation-generic | inferential | 4 | 1 (multi) | existing |
| boxplot-generic | plotting | 5 | 3 (mixed types) | existing |
| **chi-square-test** | **inferential** | **5** | **1 (multi factor)** | **~3 min** |
| **frequency-table** | **inferential** | **4** | **2 (multi+single)** | **~4 min** |
| **row-summary** | **data-prep** | **5** | **1 (multi numeric)** | **~5 min** |
| **convert-columns** | **data-prep** | **5** | **1 (multi any)** | **~5 min** |

**Porting economics**: ~4 minutes per spec average. The 55% "simple" tier of VB.NET dialogs (~190 dialogs) could be batch-ported in ~1-2 weeks. The remaining ~12% (moderate, needing steps/subpaths) requires the Save/Position param kind and possibly a multi-step generic renderer extension.

Only ggplot composition and deeply custom UIs remain as custom components (~8% of dialogs).
