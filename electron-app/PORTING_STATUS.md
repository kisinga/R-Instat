# R-Instat Electron Port - Status Overview

## Executive Summary

**Original R-Instat**: ~318 dialogs across 10+ menus (VB.NET + R backend)  
**Electron POC**: 15 dialogs across 5 menus (Angular + Electron + R backend)  
**Port Coverage**: ~5% of dialogs, but covers core POC functionality

---

## What's Been Implemented

### Architecture (Complete)
- Electron main process with security best practices (sandbox, contextIsolation)
- Angular 19 renderer with standalone components
- R bridge via JSON stdio (child process communication)
- Auto-install of missing R packages with progress UI
- AG Grid for data viewing with pagination
- i18n support (English, French)
- Dark/light theme toggle
- Toast notifications

### Menus Implemented

| Menu | Items | Status |
|------|-------|--------|
| **File** | Import, Save | ✅ Basic |
| **Data** | Filter, Sort, Calculate, Recode, Rename | ✅ Complete |
| **Describe** | Describe (unified), Quick Summary, Quick Graph, Histogram, Boxplot, Scatter, Bar Chart | ✅ Core |
| **Model** | Correlation, t-Test, Regression | ✅ Core |
| **View** | Native Electron | ✅ |
| **Help** | About, Documentation link | ✅ Basic |

### Dialogs Implemented (15 total)

| Dialog | Features | Complexity |
|--------|----------|------------|
| **Import** | File upload (CSV, Excel, RDS), R package datasets, Instat collection | Full |
| **Filter** | Expression-based row filtering | Basic |
| **Sort** | Single/multi-column sorting | Basic |
| **Calculate** | New column from R expression | Basic |
| **Recode** | Value replacement with conditions | Basic |
| **Rename** | Column renaming | Basic |
| **Describe** | Unified dialog with Summary/Graph/Frequency tabs, variable type detection | Advanced |
| **Summary** | Quick descriptive statistics | Basic |
| **Histogram** | Single variable with bins control | Basic |
| **Boxplot** | Variable by optional factor | Basic |
| **Scatter** | X vs Y with optional grouping | Basic |
| **Bar Chart** | Factor variable counts | Basic |
| **Correlation** | Pairwise correlation matrix | Basic |
| **t-Test** | One-sample, two-sample, paired | Full |
| **Regression** | Simple linear regression | Basic |

### Core Services
- `RService` - R process communication, dataframe management
- `ThemeService` - Dark/light mode persistence
- `LanguageService` - i18n with ngx-translate
- `ToastService` - User notifications
- `KeyboardService` - Global shortcuts

### Shared Components
- `ColumnPicker` - Reusable column selection with type icons
- `LoadingOverlay` - Full-screen loading state
- `RHealthOverlay` - R process status/recovery
- `ToastContainer` - Notification display

---

## What's Missing (by Category)

### 1. File Operations (~15 dialogs)
| Dialog | Purpose |
|--------|---------|
| Save/SaveAs | Save workspace, export formats |
| Export Dataset | CSV, Excel, SPSS, Stata, etc. |
| Export Graph | PNG, PDF, SVG |
| Open NetCDF | Climate data format |
| Import from ODK/RapidPro | Survey data |
| Import Gridded Data | Satellite/climate data |
| Backup/Restore | Session management |

### 2. Data Preparation (~60 dialogs)
| Category | Examples |
|----------|----------|
| Restructure | Stack, Unstack, Pivot, Transpose |
| Merge/Join | Append, Merge, Add Link/Key |
| Column Operations | Duplicate, Reorder, Convert types, Insert |
| Row Operations | Delete rows, Subset, Random sample |
| Text Handling | Split, Combine, Transform, Wordwrap |
| Factor Operations | Reorder levels, Combine levels, Reference level |
| Date/Time | Make date, Day/Month extraction |
| Missing Data | Infill, Find, Replace |
| Metadata | Column/DataFrame metadata management |

### 3. Describe (~40 dialogs)
| Category | Examples |
|----------|----------|
| One Variable | Frequencies, Stem & Leaf, Quantiles |
| Two Variable | Cross-tabs, Compare columns |
| Three Variable | Pivot tables, Three-way frequencies |
| Graphs | Line plot, Dot plot, Mosaic, Parallel coordinates, Heatmap |
| Tables | Summary tables, Frequency tables |

### 4. Model (~50 dialogs)
| Category | Examples |
|----------|----------|
| ANOVA | One-way, Two-way, General |
| Non-parametric | Mann-Whitney, Kruskal-Wallis, Chi-square |
| Regression | Multiple, GLM, Polynomial |
| Advanced | PCA, Cluster analysis, Survival, Time series |
| Model Management | Compare, Use, View models |

### 5. Climatic Menu (~80 dialogs) - **Not Started**
| Category | Examples |
|----------|----------|
| Define | Climate object, Station definitions |
| Prepare | Tidy daily data, Infill, Quality checks |
| Describe | Inventory, Summaries, Extremes |
| PICSA | Rainfall, Crops, Temperature |
| Analysis | SPI, Evapotranspiration, Start/End of rains |
| Graphs | Climograph, Windrose, Inventory plot |

### 6. Structured Menu - **Not Started**
Survey analysis, Corruption indices, Tricot data

### 7. Tools/Options - **Not Started**
R packages management, Themes customization, Calculator

---

## Technical Gaps

### R Bridge Limitations
- No databook object (uses simple env-based storage)
- No metadata persistence
- No undo/redo history
- Limited to single R session

### UI/UX Gaps
- No drag-and-drop column selection
- No column context menus
- No cell editing in grid
- No multiple dataframe tabs
- No script editor/log window
- No keyboard navigation in dialogs

### Missing Infrastructure
- No project file format (.instat equivalent)
- No recent files list
- No auto-save
- No print functionality
- No help system integration

---

## Priority Recommendations for Next Phase

### High Priority (Core Workflow)
1. **Save/Export** - Essential for completing analysis workflow
2. **Stack/Unstack** - Critical data restructuring
3. **Merge** - Combining datasets
4. **More Graphs** - Line plot, Dot plot at minimum

### Medium Priority (Statistical Power)
1. **Chi-square test** - Common categorical analysis
2. **One-way ANOVA** - Group comparisons
3. **Multiple regression** - Extend current basic regression
4. **Frequencies dialog** - Standalone from Describe

### Lower Priority (Domain-Specific)
1. **Climatic menu** - Large scope, domain-specific
2. **Structured menu** - Specialized use cases
3. **Advanced modeling** - PCA, clustering, survival

---

## File Counts Comparison

| Area | Original | Electron POC |
|------|----------|--------------|
| Dialog files | 318 .vb | 15 components |
| R scripts | 86 .R | 1 bridge.R |
| Forms/UI | 814 .resx | Angular templates |
| Total VB files | 1051 | N/A |

---

*Last updated: January 2026*
