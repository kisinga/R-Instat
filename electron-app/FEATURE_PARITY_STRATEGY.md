# Feature Parity Strategy: Intent-Driven Dialog Architecture

Single source of truth for the Electron rewrite's approach to achieving feature parity with the VB.NET application.

**Supersedes**: `dialog-parity-governance.md`, `dialog-parity-wave-plan.md`, `dialog-parity-boundaries-adr.md`, `dialog-parity-template.md`. Those files are retained as historical context but this document governs.

---

## 1. Current State

| Metric | VB.NET | Electron |
|---|---|---|
| Analytical dialogs | 342 unique `.vb` files | 28 migrated |
| Sub-dialogs | 85 `sdg*.vb` files | 0 |
| Reusable controls | 116 `ucr*` classes | ~5 |
| R functions callable | 500+ | ~60 |
| Test coverage | Manual QA | Structural parity tests + builder specs |

The Electron app has correct architectural foundations (immutable R codegen, signals, process isolation, enforced lifecycle) but ~8% feature coverage.

---

## 2. Architectural Decision: Intent-Driven Dialogs

### The Problem

Porting 342 dialogs as individual Angular components (each with template, signals, builder wiring) is ~250 lines per dialog. At that rate, feature parity requires writing and maintaining ~85,000 lines of dialog-specific UI code.

### The Decision

Dialogs are **data, not code**. Each statistical operation is described by an `OperationSpec` (schema + builder + flow). A single generic dialog shell renders the form from the spec. Custom components are reserved for operations that cannot be expressed declaratively.

### What Already Exists

The infrastructure for this is 90% built:

| Piece | Status | Location |
|---|---|---|
| Parameter schema type | Done | `dialog-schema.registry.ts` — `DialogParamSchema` |
| Builder functions | Done | `builders/*.ts` — pure `(state) => RSyntax` |
| Dialog lifecycle | Done | `dialog-base.ts` — init, save/restore, metadata, execute |
| Form field registry | Done | `DialogBase.registerFormFields()` |
| Reactive rebuild | Done | `DialogBase.createRebuildEffect()` |
| AI catalog descriptors | Done | `getCatalogDescriptor()` on each dialog |
| Operation taxonomy | Done | `operation-registry.ts` — `PrimaryKind` x `DerivedKind` |
| Parity consistency checks | Done | `dialog-parity-check.ts` — CI gate |

### What Needs to Be Built

1. **Generic dialog renderer** — takes `DialogParamSchema[]` and renders the form
2. **OperationSpec type** — unifies schema, builder, flow steps, and subpaths
3. **Step/subpath support** — for multi-step and branching operations
4. **Parity test runner** — automated validation (see Section 6)

---

## 3. Dialog Classification

Analysis of all 342 VB.NET dialogs by structural complexity (private fields, sub-dialog references, R function count, radio button branches):

### Simple Generic (187 dialogs, 55%)

**Criteria**: <= 4 private R/control fields, <= 2 sub-dialog refs, <= 9 R functions, <= 2 radio groups.

**Examples**: `dlgSort`, `dlgRenameDataFrame`, `dlgDeleteDataFrames`, `dlgSubset`, `dlgPermuteColumn`, `dlgRandomSample`, `dlgAppend`, `dlgHideShowColumns`, `dlgFreezeColumns`, `dlgLockUnlock`, `dlgSelectColumns`, `dlgCopyDataFrame`, `dlgWordwrap`, `dlgJitter`, `dlgGlance`, `dlgAugment`, `dlgTidy`

**In the intent-driven model**: Pure `OperationSpec` — schema + builder, no custom template. The generic renderer handles everything. Most are "pick dataframe, pick columns, set 1-3 options, run R."

**Effort per dialog**: ~30-50 lines of spec + builder function.

### Moderate Generic (79 dialogs, 23%)

**Criteria**: 5-24 private fields, or 3-7 sub-dialog refs, or 10-29 R functions, or 3-5 radio groups.

**Examples**: `dlgCorrelation`, `dlgOneWayFrequencies`, `dlgConversions`, `dlgDuplicates`, `dlgStack`, `dlgUnstack`, `dlgSplitText`, `dlgDotPlot`, `dlgCumulativeDistribution`, `dlgFromLibrary`, `dlgImportFromEPicsa`, `dlgExportToClimsoft`, `dlgShowModel`, `dlgClusterAnalysis`, `dlgSPI`

**In the intent-driven model**: `OperationSpec` with **steps** (sequential parameter groups) and/or **subpaths** (branching based on enum choice). The generic renderer handles the form; the spec describes the flow. Some may need 1-2 custom field components (e.g., a formula builder).

**Effort per dialog**: ~50-100 lines of spec + builder function.

### Custom Component (76 dialogs, 22%)

**Criteria**: >= 25 private fields, or >= 8 sub-dialog refs, or >= 30 R functions, or >= 6 radio groups.

**Examples**: `dlgBarAndPieChart`, `dlgBoxPlot`, `dlgHistogram`, `dlgScatterPlot`, `dlgLinePlot`, `dlgEndOfRainsSeason`, `dlgClimograph`, `dlgStartofRains`, `dlgClimaticSummary`, `dlgTransform`, `dlgTransformText`, `dlgCalculator`, `dlgScript`, `dlgHomogenization`, `dlgStringHandling`, `dlgTwoVariableFitModel`, `dlgEvapotranspiration`, `dlgClimdexIndices`, `dlgExtremesClimatic`

**Why they can't be generic**: These have compositional UIs (ggplot layer editors), deep sub-dialog trees, complex branching across 4+ modes, or domain-specific interactions that a flat schema can't express.

**In the intent-driven model**: Full Angular component extending `DialogBase`. These still publish `getCatalogDescriptor()` for AI integration and follow the same lifecycle — they just own their template.

**Effort per dialog**: ~200-500 lines of component code + builder.

### Summary

| Category | Count | % | Approach | Effort per dialog |
|---|---|---|---|---|
| Simple generic | 187 | 55% | OperationSpec only | ~30-50 lines |
| Moderate generic | 79 | 23% | OperationSpec + steps/subpaths | ~50-100 lines |
| Custom component | 76 | 22% | Full Angular component | ~200-500 lines |

**The generic system covers 78% of dialogs.** The remaining 22% still benefit from the shared `DialogBase`, builder pattern, and AI catalog integration.

---

## 4. OperationSpec Design

```typescript
interface OperationSpec {
  // Identity (from OperationRegistry)
  id: string;                          // 'data.sort'
  label: string;                       // 'Sort Rows'
  primaryKind: PrimaryKind;
  derivedKind: DerivedKind;
  description: string;

  // Schema (from DialogParamSchema — already exists)
  params: DialogParamSchema[];

  // R code generation (from builder functions — already exists)
  builder: (state: Record<string, any>) => RSyntax;

  // Validation (simple predicate)
  validate?: (state: Record<string, any>) => boolean;

  // Flow control (NEW)
  steps?: OperationStep[];             // sequential parameter groups
  subPaths?: SubPath[];                // branching based on enum param

  // AI integration (from getCatalogDescriptor — already exists)
  family: DialogFamily;
  retrievalHints: { keywords: string[] };

  // Parity tracking
  legacyDialog: string;                // 'dlgSort.vb'
  parityStatus: 'spec-only' | 'tested' | 'validated';
}

interface OperationStep {
  id: string;
  label: string;                       // 'Select Variables', 'Configure Options'
  params: string[];                    // names of params shown in this step
}

interface SubPath {
  discriminator: string;               // param name that controls branching
  value: string | number | boolean;    // value that activates this subpath
  label: string;
  params: string[];                    // additional params for this path
  builder?: (state: Record<string, any>) => RSyntax;  // override builder
}
```

### Graduation Rule

The moment an operation needs something the spec cannot express declaratively, it **graduates to a custom component**. No exceptions. No adding `customTemplate`, `onChangeCallback`, or `renderOverride` to the spec type.

---

## 5. Parity Contract Template

Every operation (generic or custom) must have a parity contract before shipping. This replaces the previous markdown-only template with a structured, testable format.

### 5.1 Parity Contract File (one per operation)

Location: `electron-app/src/app/core/parity/<operation-id>.parity.ts`

```typescript
interface ParityContract {
  operationId: string;
  legacyDialog: string;                // VB.NET file path

  // Every user-facing option in VB.NET, mapped
  optionMap: ParityOption[];

  // Every flow branch, mapped
  flowMap: ParityFlow[];

  // R code fixtures for Layer 2 validation
  fixtures: ParityFixture[];
}

interface ParityOption {
  legacyOption: string;                // 'Position: Jitter'
  specParam: string | null;            // null = not ported
  status: 'exact' | 'equivalent' | 'missing' | 'intentional-diff';
  disposition?: string;                // why deferred, approval ref
}

interface ParityFlow {
  legacyBranch: string;                // 'rdoValue selected'
  specExpression: string | null;       // 'subPath: chartType=value'
  status: 'exact' | 'equivalent' | 'missing';
}

interface ParityFixture {
  name: string;                        // 'frequency bar with fill and dodge'
  state: Record<string, any>;          // input state
  expect: FixtureExpectation;
}

interface FixtureExpectation {
  // R code structural assertions
  containsFunctions: string[];         // ['ggplot', 'geom_bar']
  containsParams?: Record<string, string[]>;  // { 'geom_bar': ['stat = "count"'] }
  containsAes?: string[];             // ['x = species', 'fill = island']
  notContains?: string[];             // ['coord_flip']

  // For Layer 3 (optional, used in random sampling CI)
  rOutputHash?: string;               // hash of R output for equivalence check
}
```

### 5.2 Parity Status Lifecycle

```
spec-only → tested → validated
```

- **spec-only**: OperationSpec exists, parity contract written, no automated tests yet
- **tested**: Layer 2 snapshot tests pass (R code structure matches fixtures)
- **validated**: Layer 3 R output equivalence confirmed for at least one CI run

---

## 6. Validation Layers

### Layer 1: Spec Completeness (CI, every run)

Already implemented in `dialog-parity-check.ts`. Extended for the intent-driven model:

- Every `OperationSpec` has a parity contract file
- Every parity contract has `optionMap` entries for all VB.NET options
- No unresolved `missing` items with severity `high`
- Schema/operation/identity consistency passes (`buildParityConsistencyReport()`)

**Runs**: Every CI build. Blocks merge if failing.

### Layer 2: R Code Snapshot Tests (CI, every run)

The primary validation layer. For each parity fixture:

1. Run the builder with the fixture's `state`
2. Assert the R code output matches `containsFunctions`, `containsParams`, `containsAes`, `notContains`
3. Assert no regression from previous snapshot

```typescript
// Generic test runner — one file covers all specs
describe('parity snapshot tests', () => {
  for (const contract of ALL_PARITY_CONTRACTS) {
    describe(contract.operationId, () => {
      for (const fixture of contract.fixtures) {
        it(fixture.name, () => {
          const spec = OPERATION_SPECS[contract.operationId];
          const script = spec.builder(fixture.state).toScript();

          for (const fn of fixture.expect.containsFunctions) {
            expect(script).toContain(fn);
          }

          if (fixture.expect.containsParams) {
            for (const [fn, params] of Object.entries(fixture.expect.containsParams)) {
              for (const param of params) {
                expect(script).withContext(`${fn}: ${param}`).toContain(param);
              }
            }
          }

          if (fixture.expect.containsAes) {
            for (const aes of fixture.expect.containsAes) {
              expect(script).toContain(aes);
            }
          }

          if (fixture.expect.notContains) {
            for (const absent of fixture.expect.notContains) {
              expect(script).not.toContain(absent);
            }
          }
        });
      }
    });
  }
});
```

**Where fixtures come from**:

1. Read the VB.NET dialog's `SetDefaults()` and `SetRCodeForControls()` to identify parameter combinations
2. Run the VB.NET dialog with specific inputs, copy R code from script window
3. Translate to `ParityFixture` format: state inputs + structural expectations
4. AI can assist: give Claude the VB.NET source and ask it to enumerate the branches

**Runs**: Every CI build. Blocks merge if failing.

**Minimum coverage**: Every operation must have at least one fixture per subpath/step. For operations with N subpaths, minimum N fixtures.

### Layer 3: R Output Equivalence (CI, random sample)

Runs actual R code and compares output between the spec's builder and a golden reference (captured from VB.NET or manually verified).

**Design for random sampling**:

```typescript
describe('R output equivalence (sampled)', () => {
  // Select 3 random operations per CI run
  const allValidated = ALL_PARITY_CONTRACTS.filter(c =>
    c.fixtures.some(f => f.expect.rOutputHash)
  );
  const sampled = randomSample(allValidated, 3, CI_SEED);

  for (const contract of sampled) {
    describe(contract.operationId, () => {
      for (const fixture of contract.fixtures.filter(f => f.expect.rOutputHash)) {
        it(`${fixture.name} produces equivalent R output`, async () => {
          const spec = OPERATION_SPECS[contract.operationId];
          const script = spec.builder(fixture.state).toScript();

          // Execute in real R process
          const result = await rService.execute(script);
          const outputHash = hashROutput(result);

          expect(outputHash).toBe(fixture.expect.rOutputHash);
        });
      }
    });
  }
});

// Deterministic random selection seeded by CI run number
// Ensures every operation is eventually covered across runs
function randomSample<T>(items: T[], n: number, seed: number): T[] {
  const rng = seededRandom(seed);
  const shuffled = [...items].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}
```

**Golden reference capture**: The `rOutputHash` is generated once by running the R code (either from VB.NET script window output or from a verified builder output) and storing the hash. This is a manual step per fixture, done during parity review.

**VB.NET automation**: We cannot automate R execution from VB.NET in CI. Instead:
1. A domain expert runs the VB.NET dialog with fixture inputs
2. Copies the R code from the script window
3. Runs it in R, captures the output hash
4. Adds `rOutputHash` to the fixture

This is a one-time cost per fixture, not per CI run.

**Runs**: Every CI build, but only 3 random operations. Over ~30 builds, all operations with Layer 3 fixtures are covered. Failures are warnings, not blockers (to account for R version differences, floating point, etc.).

---

## 7. Waves (Updated)

### Wave 0: Infrastructure (Current)

Build the generic dialog system before porting more dialogs.

| Task | Status |
|---|---|
| `OperationSpec` type definition | Planned |
| Generic dialog renderer component | Planned |
| Step/subpath rendering support | Planned |
| `ParityContract` type and test runner | Planned |
| Layer 2 test harness | Planned |
| Layer 3 random-sample test harness | Planned |
| Enhanced ColumnPicker with receiver semantics | Planned |

### Wave 1: Core Plotting (6 dialogs) — Custom Components

These are all high-complexity (ggplot composition) and need custom components.

| Dialog | Legacy | Category | Parity Status |
|---|---|---|---|
| bar-chart | `dlgBarAndPieChart.vb` | Custom | Completed (core scope) |
| histogram | `dlgHistogram.vb` | Custom | Completed (core scope) |
| boxplot | `dlgBoxPlot.vb` | Custom | Planned |
| scatter | `dlgScatterPlot.vb` | Custom | Planned |
| line-plot | `dlgLinePlot.vb` | Custom | Planned |
| dot-plot | `dlgDotPlot.vb` | Custom | Planned |

### Wave 2: Data Preparation (first generic specs)

Mix of simple generic and moderate generic. These are the first dialogs to use the `OperationSpec` system.

| Dialog | Legacy | Category | Parity Status |
|---|---|---|---|
| sort | `dlgSort.vb` | Simple generic | Planned |
| rename | `dlgRenameDataFrame.vb` | Simple generic | Planned |
| filter | `dlgSelect.vb` | Moderate generic | Planned |
| calculate | `dlgCalculator.vb` | Custom | Planned |
| merge | `dlgMerge.vb` | Simple generic | Planned |
| stack | `dlgStack.vb` | Moderate generic | Planned |
| unstack | `dlgUnstack.vb` | Moderate generic | Planned |
| recode | `dlgRecodeNumeric.vb` | Moderate generic | Planned |
| delete-rows-columns | `dlgDeleteRowsOrColums.vb` | Simple generic | Planned |
| subset | `dlgSubset.vb` | Simple generic | Planned |
| append | `dlgAppend.vb` | Simple generic | Planned |

### Wave 3: Climatic Domain (9 dialogs) — Mix

| Dialog | Legacy | Category | Parity Status |
|---|---|---|---|
| climatic-summary | `dlgClimaticSummary.vb` | Custom | Planned |
| annual-rainfall | `dlgAnnualRaintotal.vb` | Moderate generic | Planned |
| extremes | `dlgExtremesClimatic.vb` | Custom | Planned |
| day-count | `dlgCountsTotals.vb` | Simple generic | Planned |
| spell-lengths | `dlgSpells.vb` | Moderate generic | Planned |
| seasonal-summary | `dlgSeasonalSummary.vb` | Moderate generic | Planned |
| missing-report | `dlgMissingData.vb` | Moderate generic | Planned |
| temperature-summary | `dlgTemperature.vb` | Moderate generic | Planned |
| inventory-plot | `dlgInventoryPlot.vb` | Custom | Planned |

### Wave 4+: Long Tail

Remaining ~300 dialogs, ported as OperationSpecs based on user demand. Prioritized by usage telemetry (once available).

---

## 8. PR-Level Gates

Every dialog PR (whether spec or custom component) must include:

1. **Parity contract** (`<operation-id>.parity.ts`) with complete `optionMap` and `flowMap`
2. **At least one Layer 2 fixture per subpath** in the parity contract
3. **Builder unit test** for each distinct R code output path
4. **Passing `buildParityConsistencyReport()`** — schema/operation/identity alignment
5. **Gap ledger**: any `missing` or `intentional-diff` items documented with disposition

Block merge if:
- A high-severity `missing` item has no approved deferral
- Layer 2 fixtures fail
- Contract consistency report returns `ok = false`

---

## 9. Gap Classification

| Status | Meaning | Action |
|---|---|---|
| `exact` | Same behavior | None |
| `equivalent` | Different implementation, same user outcome | Document rationale once |
| `missing` | Behavior absent in Electron | Create issue with severity + target wave |
| `intentional-diff` | Approved simplification | Requires product sign-off reference |

---

## 10. AI Integration

The intent-driven model strengthens AI integration:

- **AI produces `{ operationId, state }` directly** — no need to know about Angular components
- **The same OperationSpec drives both the generic renderer and AI plan validation**
- **Parity fixtures double as AI test cases** — if the AI produces state X, the builder should produce valid R code
- **New specs auto-register in the AI catalog** via the `family` + `retrievalHints` fields

The existing AI pipeline stages (`categorize` -> `scope` -> `plan` -> `validate` -> `execute`) remain unchanged. The `IntentResolverService` validates AI-produced state against `OperationSpec.params` using the same schema.

---

## 11. What Falls Outside This Document

- **Architecture comparison** (VB.NET vs Electron strengths): see `ARCHITECTURE_COMPARISON.md`
- **R codegen system design**: see `r-codegen/` module
- **AI pipeline internals**: see `ai/pipeline/` module
- **Per-dialog parity details**: see individual `parity/<operation-id>.parity.ts` files
