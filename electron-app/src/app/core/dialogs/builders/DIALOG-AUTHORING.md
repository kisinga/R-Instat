# Writing Dialogs for R-Instat (Electron)

A guide for VB.NET/R developers who know the old codebase.

## How It Compares to VB.NET

In VB.NET, you'd copy an existing dialog (e.g., `dlgSort.vb`), rename controls, change the R function, wire events. In Electron, the equivalent for most dialogs is a single JSON file — no controls to position, no events to wire, no code to copy-paste.

| | VB.NET | Electron (simple) | Electron (complex) |
|---|---|---|---|
| **What you write** | Copy `.vb` file, modify controls + R code | Write `.json` file (~20 lines) | Write TypeScript builder function (~30 lines) |
| **UI layout** | Manual pixel positioning | Automatic from `params` | Automatic from `params` |
| **Column selection** | `ucrSelector` + `ucrReceiver` wiring | `"kind": "column"` in params | Same |
| **R code generation** | `clsRFunction.SetRCommand()` + `SetParameter()` | Reference a `builderId` | Write builder using `rFn()`, `rPipe()` |
| **Conditional controls** | `AddToLinkedControls()` | `"when": { "param": "x", "equals": "y" }` | Same |
| **Time** | ~15-30 min (copy-paste-modify) | ~5-10 min | ~30-60 min |

**Genuinely easier than VB.NET:** The R code generation. In VB.NET you spread R code logic across `InitialiseDialog`, `SetDefaults`, and `SetRCodeForControls`, managing mutable `clsRFunction` objects. In Electron it's one pure function — no shared mutable state, no initialization order bugs.

**Genuinely harder (short-term):** If you need a custom Angular component (rare — <5% of dialogs), there's no visual designer. You write HTML templates instead of dragging controls. This is a learning curve, but most complex dialogs don't need custom components — they're complex because of the R code, not the form. The form is still just `params`.

**Honest friction:** VB.NET has 627 dialogs to copy from. Electron has ~40. When porting a complex climatic dialog, VB.NET gives you a nearby template. In Electron you may be writing the pattern for the first time. This gap closes as more dialogs are ported.

**Long-term payoff:** No Designer.vb files, no pixel positioning, no event handler wiring, no `Handles` keywords, no `AddHandler`. Each ported dialog is ~50% less code. And JSON specs are shareable — users can import/export dialogs, which VB.NET can't do at all.

## Step-by-Step: Porting a VB.NET Dialog

### 1. Read the VB.NET dialog

Open the `.vb` file. Find:
- **What R function it calls** — look for `SetRCommand("function_name")`
- **What parameters it sets** — look for `SetParameter` calls
- **What controls it uses** — `ucrReceiver` = column picker, `ucrInput` = text, `ucrChk` = checkbox, `ucrPnl` = radio buttons

### 2. Check if a builder already exists

Look at the builder table below. If the R function you need is already covered (e.g., `t.test`, `cor`, `ggplot + geom_boxplot`), you only need a JSON file.

### 3. Write the JSON

**Example: porting `dlgDuplicateColumns.vb`**

The VB.NET dialog calls `dplyr::mutate(new_col = old_col)`. The `duplicate-column` builder handles this.

VB.NET had: `ucrReceiverColumn` (source), `ucrInputNewName` (target name), `ucrSelectorDf` (dataframe).

JSON equivalent:
```json
{
  "formatVersion": "1.0",
  "dialogId": "duplicate-columns",
  "title": "Duplicate Column",
  "family": "data-preparation",
  "description": "Copy a column under a new name.",
  "operations": ["data.duplicate_column"],
  "params": [
    { "name": "dataframe", "kind": "dataframe", "required": true },
    { "name": "sourceColumn", "kind": "column", "required": true, "filter": "any" },
    { "name": "newColumnName", "kind": "string", "required": true }
  ],
  "retrievalHints": { "keywords": ["duplicate", "copy", "clone", "column"] },
  "builderId": "duplicate-column"
}
```

That's it. No `.Designer.vb`, no `InitialiseDialog()`, no `SetRCodeForControls()`. The form renders from `params`. The R code comes from the builder.

### 4. Place the file

Save as `src/assets/dialogs/builtin/your-dialog-id.json`. Add an import line in `builtin-json-specs.ts`. The dialog appears in the app.

---

## Mapping VB.NET Controls to JSON Params

| VB.NET Control | JSON `kind` | Notes |
|---|---|---|
| `ucrSelectorByDataFrames` | `"dataframe"` | Always first param, always required |
| `ucrReceiverSingle` | `"column"` | Add `"filter": "numeric"` for numeric-only |
| `ucrReceiverMultiple` | `"column[]"` | Multi-column selection |
| `ucrInputTextBox` | `"string"` | Free text input |
| `ucrNud` (NumericUpDown) | `"number"` | Add `"min"`, `"max"` for range |
| `ucrChk` (CheckBox) | `"boolean"` | Default false unless specified |
| `ucrPnl` (RadioButtons) | `"enum"` | Add `"enumValues": ["opt1", "opt2"]` |
| `ucrCbo` (ComboBox) | `"enum"` | Same as radio buttons |

## Mapping VB.NET Linked Controls to `when`

VB.NET:
```vb
ucrChkShowTitle.AddToLinkedControls(ucrInputTitle, {True}, bNewReceiverIsVisible:=True)
```

JSON:
```json
{ "name": "title", "kind": "string", "when": { "param": "showTitle", "equals": true } }
```

Same behavior — the title field only shows when the checkbox is checked.

## Mapping VB.NET R Code to BuilderId

VB.NET:
```vb
clsSortFunction.SetRCommand("sort_dataframe")
clsSortFunction.AddParameter("data_name", strDataFrame)
clsSortFunction.AddParameter("col_names", strColumns)
clsSortFunction.AddParameter("decreasing", bDescending)
```

JSON:
```json
"builderId": "sort"
```

The `sort` builder already knows how to call `dplyr::arrange()` with the right parameters. Your JSON just passes the param values through.

---

## Available Builders

If the R function you need is here, you only write JSON. If not, you need a TypeScript builder (see below).

### Data Manipulation
| Builder ID | VB.NET equivalent | R function |
|---|---|---|
| `sort` | `dlgSort` | `dplyr::arrange()` |
| `rename` | `dlgRenameColumn` | `dplyr::rename()` |
| `calculate` | `dlgCalculate` | `dplyr::mutate()` with formula |
| `recode` | `dlgRecode` | `dplyr::case_when()` |
| `duplicate-column` | `dlgDuplicateColumns` | `dplyr::mutate(new = old)` |
| `permute-column` | `dlgRandomSample` | `sample()` on column |
| `delete-columns` | `dlgDeleteColumn` | `dplyr::select(-cols)` |
| `insert-column` | `dlgInsertColumn` | `tibble::add_column()` |

### Statistics
| Builder ID | VB.NET equivalent | R function |
|---|---|---|
| `correlation` | `dlgCorrelation` | `cor()` + optional `cor.test()` |
| `regression` | `dlgLinearRegression` | `lm()` + summary/anova |
| `t-test` | `dlgOneSample`, `dlgTwoSample` | `t.test()` (all 3 types) |

### Graphs
| Builder ID | VB.NET equivalent | R function |
|---|---|---|
| `histogram` | `dlgHistogram` | `ggplot() + geom_histogram()` |
| `boxplot` | `dlgBoxPlot` | `ggplot() + geom_boxplot()` |
| `scatter` | `dlgScatterPlot` | `ggplot() + geom_point()` |
| `bar-chart` | `dlgBarChart` | `ggplot() + geom_bar()` |

### Custom Builders (complex R code)
| Builder ID | VB.NET equivalent | Why it needs custom logic |
|---|---|---|
| `chi-square-test` | `dlgChiSquareTest` | Conditional `correct`, `simulate.p.value` args |
| `frequency-table` | `dlgFlatFrequencyTable` | Conditional `addmargins()` wrapping |
| `row-summary` | `dlgRowSummary` | `rowwise() %>% mutate()` pipeline |
| `convert-columns` | `dlgConvertColumns` | Different `as.*()` per column |
| `one-variable-summarise` | `dlgOneVariableSummarise` | 3 entirely different R code paths |

---

## When Your R Function Isn't in the Builder List

You need a new builder. This is the equivalent of writing the `SetRCodeForControls()` section of a VB.NET dialog, but as a standalone function. The `rFn()`, `rPipe()`, `rSyntax()` API maps directly to `clsRFunction`, pipe operators, and `clsRSyntax` — same concepts, different syntax. If you've written `SetRCodeForControls()` in VB.NET, you can write a builder.

**Example: adding a Shapiro-Wilk test builder**

VB.NET would have:
```vb
clsShapiroFunction.SetRCommand("shapiro.test")
clsShapiroFunction.AddParameter("x", strDataFrame & "$" & strColumn)
```

TypeScript equivalent (add to `statistics.ts`):
```typescript
registerBuilder('shapiro-test', (state) => {
  const df = String(state['dataframe']);
  const col = String(state['column']);
  return rSyntax().setBase(`shapiro.test(${df}$${col})`);
});
```

Then write the JSON spec:
```json
{
  "formatVersion": "1.0",
  "dialogId": "shapiro-test",
  "title": "Shapiro-Wilk Normality Test",
  "family": "inferential",
  "description": "Test if a variable follows a normal distribution.",
  "operations": ["test.normality"],
  "params": [
    { "name": "dataframe", "kind": "dataframe", "required": true },
    { "name": "column", "kind": "column", "required": true, "filter": "numeric" }
  ],
  "retrievalHints": { "keywords": ["shapiro", "normality", "normal", "distribution test"] },
  "builderId": "shapiro-test"
}
```

**That's 5 lines of TypeScript + 15 lines of JSON.** Compare to ~150 lines for a VB.NET dialog with Designer file. The R knowledge is identical — you need to know `shapiro.test()` takes a numeric vector. The difference is how much plumbing wraps that knowledge.

---

## Param Reference

| Field | What it does | VB.NET equivalent |
|---|---|---|
| `name` | Param identifier | Variable name in `SetParameter()` |
| `kind` | Control type | Which `ucr*` control to use |
| `required` | Must be filled | `ucrReceiver.SetMeAsReceiver()` required flag |
| `filter` | Column type filter | `ucrReceiver.SetDataType()` |
| `label` | Display text | Control label in Designer |
| `default` | Initial value | `SetDefaults()` value |
| `group` | Collapsible section | Tab or GroupBox in VB.NET |
| `when` | Show/hide conditionally | `AddToLinkedControls()` |
| `enumValues` | Dropdown options | Radio button or ComboBox items |
| `min`, `max` | Number range | `NumericUpDown.Minimum/Maximum` |

---

## Validation Rules

VB.NET: Custom validation in `TestOkEnabled()`.

JSON:
```json
"validations": [
  { "rule": "minItems", "param": "columns", "min": 2, "message": "Select at least 2" },
  { "rule": "requiredWhen", "param": "groupVar", "when": { "param": "testType", "equals": "two" } }
]
```

---

## Sharing Dialogs

This is new — VB.NET doesn't have an equivalent.

- **Export**: Generic dialogs show an Export button. Saves a `.rinstat-dialog.json` file.
- **Import**: Data menu > Import Dialog Definition. The dialog appears immediately and persists across restarts.
- **Self-contained scripts**: R code embeds the dialog definition. Pasting into "Restore From Code" auto-imports unknown dialogs.

---

## File Locations

```
JSON specs:         src/assets/dialogs/builtin/*.json
TS specs:           src/app/core/ai/generic-dialog/specs/*.ts
Builder registry:   src/app/core/dialogs/builders/builder-registry.ts
Builders:           src/app/core/dialogs/builders/{data-manipulation,statistics,graphs,barchart}.ts
JSON loader:        src/app/core/ai/generic-dialog/builtin-json-specs.ts
TS spec barrel:     src/app/core/ai/generic-dialog/specs/index.ts
Dialog renderer:    src/app/features/dialogs/generic/generic-dialog.component.ts
Dialog library:     src/app/core/services/dialog-library.service.ts
```
