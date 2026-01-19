# Describe Dialog

Unified dialog for exploring data through summaries, graphs, and frequencies.

## Workflow

```
1. Select dataframe
2. Select variables (1 or more)
3. Choose output: Summary | Graph | Frequency
4. Configure options (auto-adapts to variable types)
5. Execute (Ctrl+Enter)
```

## Variable Type Detection

| Selection | Detected As | Default Graph |
|-----------|-------------|---------------|
| 1 numeric | single-numeric | histogram |
| 1 categorical | single-categorical | bar-chart |
| 2+ numeric | multi-numeric | scatter |
| 2+ categorical | multi-categorical | stacked-bar |
| numeric + categorical | numeric-by-categorical | boxplot |
| mixed (3+ vars) | mixed | boxplot |

## Output Modes

**Summary**: R's `summary()`, `dplyr::summarise()`, or `skimr::skim_without_charts()`  
**Graph**: ggplot2-based, type adapts to variable combination  
**Frequency**: `sjmisc::frq()` (1-way) or `sjPlot::sjtab()` (2-way)

## Keyboard Shortcuts

- `Ctrl+D` - Open dialog (from menu)
- `Ctrl+Enter` - Execute
- `Ctrl+1/2/3` - Switch tabs
- `Ctrl+P` - Toggle code preview

## Files

```
describe/
├── describe-dialog.component.ts   # Main dialog
├── describe-dialog.service.ts     # State management
├── panels/
│   ├── summary-panel.component.ts
│   ├── graph-panel.component.ts
│   └── frequency-panel.component.ts
└── utils/
    ├── variable-type-analyzer.ts  # Type detection
    └── r-code-builders.ts         # R code generation
```

---

## Differences from VB Implementation

| Aspect | VB (Original) | Electron (New) |
|--------|---------------|----------------|
| Entry points | 3+ menus (One Variable, Two/Three Variables, Specific Graphs) | 1 menu (Describe Data) |
| Variable count | Must pre-select 1-var vs 2-var dialog | Auto-adapts to selection |
| Mode flags | `OnevariableMode.Prepare/Describe/Climatic/Tricot` per dialog | None - context-free |
| Graph selection | Fixed per dialog type | Dynamic based on variable types |
| Sub-dialogs | Chain of modal sub-dialogs for options | Inline options in single panel |
| Code visibility | Hidden, complex `RFunction` object model | R code preview toggle |
| State | Spread across 15+ dialog classes | Single service with signals |

### VB Menu Structure (Replaced)
```
Describe
├── One Variable
│   ├── Summarise...
│   ├── Graph...
│   └── Frequencies...
├── Two/Three Variables
│   ├── Summarise...
│   ├── Graph...
│   ├── Correlations...
│   └── Frequencies...
└── Specific Tables/Graphs
    ├── Histogram...
    ├── Boxplot...
    └── ... (12+ items)
```

### New Menu Structure
```
Describe
├── Describe Data...     (Ctrl+D)
├── ─────────────
├── Quick Summary...
├── Quick Graph...
├── ─────────────
└── Specific Graphs
    ├── Histogram...
    ├── Box Plot...
    ├── Scatter Plot...
    └── Bar Chart...
```


## Potential Regressions

1. **Specific graph dialogs still exist**: Histogram, Boxplot, etc. remain as separate dialogs accessible via Specific Graphs submenu. No breaking change.

2. **Quick Summary/Graph shortcuts**: Open same dialog with tab pre-selected. Original dialogs (`dlgOneVariableSummarise`, `dlgOneVariableGraph`) functionality preserved.

3. **Missing VB features not ported**:
   - Rating Data (specialized)
   - Three-way frequencies (use Frequency tab with 2 vars + groupBy)
   - Multivariate (Correlations, PCA, Cluster) - separate dialogs
   - Graph themes sub-dialog - minimal options inline instead
