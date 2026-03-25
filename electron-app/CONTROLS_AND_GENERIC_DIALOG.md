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
| ucrReceiverSingle | ~200 uses | `column` (with columnType filter) | Metadata filtering, drag-drop |
| ucrReceiverMultiple | ~148 uses | `column[]` | Same as above |
| ucrDataFrame selector | Every dialog | `dataframe` | None |
| ucrSave | 306 uses | `string` (outputName) | Position dialog missing |
| ucrRadio (deprecated) | ~10 uses | `enum` | None |

**78% of control usage is already covered** by the generic renderer's existing param types. The validated side-by-side comparisons confirm this:

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

### 4.1 Enhanced Column Picker (replaces selector/receiver, 9 controls)

The selector/receiver system is the only `ucr*` pattern that provides UX value beyond simple data binding. What it does that our current `ColumnPickerComponent` doesn't:

| Feature | VB.NET selector/receiver | Current ColumnPicker | Impact |
|---|---|---|---|
| All columns visible at once | ListView shows all columns | Dropdown hides list | Users scan faster |
| Multi-receiver coordination | Selector auto-focuses next receiver after adding | Each picker is independent | Faster workflow for multi-column dialogs |
| Metadata filtering | Filter by class, hidden status, climatic type | Filter by basic type only | Domain-specific intelligence |
| Drag-and-drop | Natural column-to-slot interaction | Click to select | Ergonomic for frequent use |
| Auto-fill | If only one column matches filter, auto-select it | No auto-fill | Fewer clicks for constrained receivers |

**What this means for the generic dialog**: An enhanced ColumnPicker would make the generic renderer cover ~90%+ of dialogs instead of ~78%. The `column` and `column[]` param kinds would gain metadata filtering and auto-fill for free — every generic spec benefits without changing a single spec file.

**Estimated scope**: One component (~300-400 lines) replacing 9 VB.NET controls (~3,000 lines combined). Usable by both generic specs and custom components.

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

### Build now (high leverage for generic dialog)

1. **Enhanced ColumnPicker** — metadata filtering, auto-fill, multi-receiver coordination. Every generic spec and custom dialog benefits. This is the single highest-leverage component.

### Build when needed (moderate leverage)

2. **Save/Position param kind** — unblocks generic specs for the ~200 data-preparation dialogs that create output columns.

### Don't build (no leverage)

3. Everything else. The 82 input/checkbox/button/table/data controls are WinForms plumbing that Angular's built-in facilities already replace. The ggplot layer controls are custom-component territory and not generic-dialog-relevant.

---

## 7. What the Generic Dialog System Looks Like After the Enhanced ColumnPicker

Today (current ColumnPicker):
- **78% of dialogs** can be generic specs
- Column selection is a dropdown — functional but loses the VB.NET UX advantages

With Enhanced ColumnPicker:
- **~88% of dialogs** can be generic specs (the moderate-complexity 23% category mostly just needs better column selection)
- Column selection matches VB.NET ergonomics
- Metadata filtering enables climatic domain specs (auto-fill date/station/element columns)
- **No spec changes needed** — the `column` and `column[]` param kinds just render better

With Enhanced ColumnPicker + Save/Position:
- **~92% of dialogs** can be generic specs
- Full data-preparation workflow coverage
- Only ggplot composition and deeply custom UIs remain as custom components
