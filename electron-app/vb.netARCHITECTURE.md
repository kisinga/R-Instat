# R-Instat VB.NET Architecture Documentation

## Overview

R-Instat's VB.NET application is a **Windows Forms desktop application** built on **.NET Framework 4.8**. It provides a GUI frontend for statistical data analysis powered by an embedded R engine. The codebase contains **~1,100 .vb source files** totalling **~488,000 lines of code**, with **627 dialog forms**, **116 user controls**, **170 sub-dialogs**, and **18 frames/forms**.

---

## Table of Contents

1. [Three-Band View (Correlation with Electron App)](#three-band-view)
2. [Folder Structure](#folder-structure)
3. [Solution and Project Structure](#solution-and-project-structure)
4. [Class Hierarchy and Inheritance](#class-hierarchy-and-inheritance)
5. [Interface Definitions and Contracts](#interface-definitions-and-contracts)
6. [R Integration Layer](#r-integration-layer)
7. [R Code Generation Framework](#r-code-generation-framework)
8. [Dialog System and Lifecycle](#dialog-system-and-lifecycle)
9. [Control Architecture (ucr* Controls)](#control-architecture)
10. [Data Model Layer](#data-model-layer)
11. [Grid and Spreadsheet System](#grid-and-spreadsheet-system)
12. [Output and Logging System](#output-and-logging-system)
13. [Event-Driven Patterns](#event-driven-patterns)
14. [Dependency Management and Service Locator](#dependency-management-and-service-locator)
15. [Configuration and Options](#configuration-and-options)
16. [Threading and Async Execution](#threading-and-async-execution)
17. [Localization System](#localization-system)
18. [Design Patterns Summary](#design-patterns-summary)
19. [Complete Data Flow](#complete-data-flow)
20. [Correlation with Electron App](#correlation-with-electron-app)

---

## Three-Band View

Like the Electron app, the VB.NET app maps onto the same **Data / Processing / Presentation** bands:

```
+-----------------------+-------------------------+-----------------------------+
|        DATA           |      PROCESSING         |       PRESENTATION          |
+-----------------------+-------------------------+-----------------------------+
| clsDataBook           | clsRLink (REngine)      | frmMain (MDI container)     |
| clsDataFrame          | clsRFunction            | dlg* (627 dialog forms)     |
| clsColumnMetaData     | clsROperator            | sdg* (170 sub-dialogs)      |
| clsDataFrameMetaData  | clsRParameter           | ucr* (116 user controls)    |
| clsDataFramePage      | clsRSyntax              | frm* (18 forms)             |
| clsDataFrameFilter    | clsRCodeStructure       | clsGridLink (ReoGrid)       |
| InstatOptions         | REngine (R.NET)         | clsOutputLogger             |
+-----------------------+-------------------------+-----------------------------+
```

**Electron correlation**: The three bands are identical in purpose. `clsDataBook` maps to `data_store`, `clsRLink` maps to `RService + r-bridge.ts`, and `frmMain + dialogs` map to `Shell + Dialog components`.

---

## Folder Structure

```
/R-Instat/
+-- Instat.sln                         # Visual Studio solution (VS 2019, .NET 4.8)
+-- instat/                            # Main VB.NET project
|   +-- instat.vbproj                  # Project file (WinExe output)
|   +-- App.config                     # Application configuration
|   +-- NLog.config                    # Logging configuration
|   +-- app.manifest                   # Application manifest
|   +-- ApplicationEvents.vb          # App startup/shutdown, single-instance handling
|   +-- Translations.vb               # Translation/localization utilities
|   |
|   +-- [ROOT .vb FILES]              # ~1,000 files at root level
|   |   +-- dlg*.vb                   # 627 dialog forms (main UI entry points)
|   |   +-- sdg*.vb                   # 170 sub-dialogs (nested/secondary dialogs)
|   |   +-- ucr*.vb                   # User controls (reusable components)
|   |   +-- cls*.vb                   # Utility/service classes
|   |   +-- frm*.vb                   # Frame/window forms
|   |   +-- *.Designer.vb            # Auto-generated UI layout code
|   |   +-- *.resx                   # Resource files (strings, images)
|   |   +-- *.sw-KE.resx            # Swahili localized resources
|   |
|   +-- Model/                        # Business logic and data structures
|   |   +-- DataFrame/               # Data management (6 files)
|   |   |   +-- clsDataBook.vb       # Top-level data container
|   |   |   +-- clsDataFrame.vb      # Single dataframe representation
|   |   |   +-- clsColumnMetaData.vb # Column-level metadata
|   |   |   +-- clsDataFrameMetaData.vb
|   |   |   +-- clsDataFrameFilter.vb
|   |   |   +-- clsDataFramePage.vb  # Pagination/visible subset
|   |   +-- Output/                  # Output management (4 files)
|   |   |   +-- clsOutputLogger.vb   # Central output logging
|   |   |   +-- clsOutputElement.vb  # Individual output item
|   |   |   +-- clsOutputList.vb     # Filtered output collections
|   |   |   +-- clsRScriptElement.vb # R script output element
|   |   +-- RCommand/               # R command utilities
|   |   |   +-- clsPrepareFunctionsForGrids.vb
|   |   +-- Options/                # Application settings
|   |       +-- OutputFont.vb
|   |
|   +-- Interface/                    # Grid interface definitions (4 files)
|   |   +-- IGrid.vb                 # Primary grid interface
|   |   +-- IColumnMetaDataGrid.vb   # Column metadata grid contract
|   |   +-- IDataViewGrid.vb        # Data view display contract
|   |   +-- IDataframeMetaDataGrid.vb
|   |
|   +-- Enum/                        # Enumeration types (3 files)
|   |   +-- OutputType.vb
|   |   +-- RObjectFormat.vb
|   |   +-- RObjectTypeLabel.vb
|   |
|   +-- UserControl/                 # Output display controls (6 files)
|   |   +-- ucrOutputPage.vb        # Single output page
|   |   +-- ucrOutputPages.vb       # Output page collection
|   |   +-- ucrTextViewer.vb        # Text output viewer
|   |   +-- ucrImageViewer.vb       # Image/graph viewer
|   |   +-- frmMaximiseOutput.vb    # Maximized output window
|   |
|   +-- UserControls/               # Complex control implementations
|   |   +-- DataGrid/               # Grid implementations
|   |   |   +-- ReoGrid/            # ReoGrid-based (Windows primary)
|   |   |   |   +-- ucrReoGrid.vb  # MustInherit base
|   |   |   |   +-- ucrDataViewReoGrid.vb
|   |   |   |   +-- ucrColumnMetadataReoGrid.vb
|   |   |   |   +-- ucrDataframeMetadataReoGrid.vb
|   |   |   +-- Linux/             # Linux alternative grid
|   |   |       +-- ucrLinuxGrid.vb # MustInherit base
|   |   +-- Webview/               # Embedded web view components
|   |
|   +-- UserTables/                  # Table UI system (101 files)
|   |   +-- dlgGeneralTable.vb      # Main table dialog
|   |   +-- clsTablesUtils.vb      # Table utilities
|   |   +-- Cells/                  # Cell-level controls (23 files)
|   |   |   +-- Formats/           # Date, Number, Text formatting
|   |   |   +-- Styles/            # Cell styling
|   |   |   +-- FootNotes/         # Cell footnotes
|   |   +-- Columns/              # Column-level controls (27 files)
|   |   +-- Rows/                 # Row-level controls (31 files)
|   |   +-- Header/               # Table header (3 files)
|   |   +-- Stub/                 # Row headers (9 files)
|   |   +-- Table/                # Overall table options (3 files)
|   |   +-- SourceNotes/          # Table source notes (3 files)
|   |
|   +-- Climsoft/                   # Climate software integration (13 files)
|   |   +-- dlgClimSoft.vb         # Main Climsoft dialog
|   |   +-- dlgClimsoftWizard.vb   # Multi-step wizard
|   |   +-- sdgClimsoft*.vb        # Sub-dialogs
|   |
|   +-- Record/                    # Record/metadata definitions
|   |   +-- clsColumnHeaderDisplay.vb
|   |
|   +-- Resources/                 # Static resources (36 files)
|   |   +-- rinstat_icon*.ico      # Application icons
|   |   +-- *.png                  # UI images
|   |
|   +-- My Project/               # VS project settings (10 files)
|   |   +-- Application.Designer.vb
|   |   +-- AssemblyInfo.vb
|   |   +-- Resources.Designer.vb
|   |   +-- Settings.Designer.vb
|   |
|   +-- static/                   # R backend components
|   |   +-- InstatObject/R/       # Core R backend
|   |   |   +-- Rsetup.R          # R environment initialization
|   |   |   +-- instat_object_R6.R # Main R6 data object
|   |   |   +-- data_object_R6.R  # Data object class
|   |   |   +-- stand_alone_functions.R
|   |   |   +-- install_packages.R
|   |   +-- ClimateObject/R/      # Climate-specific R methods
|   |   +-- DialogDefinitions/    # Cross-platform dialog definitions (JSON+R)
|   |
|   +-- translations/             # Language files (7 languages)
|   |   +-- en/, es/, fr/, it/, pt/, ru/, sw/
|   |
|   +-- MultilingualResources/    # Additional localization resources
|   +-- Recent_Files/             # Recent file management
|   +-- lib/                      # Library dependencies
|
+-- electron-app/                  # Electron/Angular frontend (separate project)
+-- packages/                      # NuGet package references
+-- installer/                     # Installation scripts
+-- docs/                          # Documentation website
+-- wiki/                          # Wiki documentation
```

### Electron App Folder Correlation

| VB.NET Location | Purpose | Electron Equivalent |
|---|---|---|
| `instat/frmMain.vb` | Main window, menu, layout | `electron-app/src/app/shell/` |
| `instat/dlg*.vb` | Dialog forms | `electron-app/src/app/features/dialogs/` |
| `instat/ucr*.vb` | Reusable controls | `electron-app/src/app/shared/components/` |
| `instat/clsRLink.vb` | R communication | `electron-app/src/r-bridge.ts` + `RService` |
| `instat/clsRFunction.vb` | R code building | `electron-app/src/app/core/r-codegen/` |
| `instat/clsRSyntax.vb` | Script aggregation | `electron-app/src/app/core/r-codegen/r-syntax.ts` |
| `instat/Model/DataFrame/` | Data model | `electron-app/src/app/core/services/app-state.service.ts` |
| `instat/Model/Output/` | Output management | `electron-app/src/app/features/output/` |
| `instat/Interface/` | Grid contracts | No direct equivalent (AG Grid used directly) |
| `instat/static/InstatObject/R/` | R backend | `electron-app/src/r-scripts/bridge.R` |

---

## Solution and Project Structure

**Solution**: `Instat.sln` (Visual Studio 2019, Format Version 12.00)

**Project**: `instat/instat.vbproj`
- **Output Type**: WinExe (Windows Executable)
- **Target Framework**: .NET Framework 4.8
- **Assembly**: instat.exe

**Key NuGet Dependencies**:

| Package | Purpose |
|---|---|
| R.NET | In-process R interoperability via REngine |
| CefSharp 104.4.240 | Chromium Embedded Framework for web views |
| unvell.ReoGrid | Spreadsheet/grid control |
| System.Data.SQLite | Database access |
| DotNetZip | ZIP file handling |
| DynamicInterop | Dynamic library interop |
| TranslateWinForm | Form localization |
| NLog | Structured logging |

---

## Class Hierarchy and Inheritance

### Naming Conventions

| Prefix | Type | Count | Purpose |
|---|---|---|---|
| `dlg` | Dialog Form | 627 | Main UI dialogs (modal windows) |
| `sdg` | Sub-Dialog | 170 | Secondary/nested dialogs |
| `ucr` | User Control | 116 | Reusable UI components |
| `frm` | Form | 18 | Application frames/windows |
| `cls` | Class | ~30 | Business logic, utilities, services |
| `I` | Interface | 4 | Grid abstraction contracts |

### Core Control Inheritance Tree

All custom controls descend from `System.Windows.Forms.UserControl` via `ucrCore`:

```
System.Windows.Forms.UserControl
  +-- ucrCore                              # Base for all R-aware controls
      +-- ucrButtons                       # Dialog OK/Cancel/Reset/Script buttons
      +-- ucrSelector                      # Data column list provider
      |   +-- ucrSelectorByDataFrame       # Filtered by active dataframe
      |       +-- ucrSelectorByDataFrameAddRemove
      +-- ucrReceiver                      # Receives selected columns from selector
      |   +-- ucrReceiverSingle            # Single column selection
      |   +-- ucrReceiverMultiple          # Multi-column selection
      |   +-- ucrReceiverExpression        # Expression builder
      +-- ucrInput                         # Text/value input base
      |   +-- ucrInputTextBox              # Free-text input
      |   +-- ucrInputComboBox             # Dropdown selection
      |   |   +-- ucrColors                # Color picker dropdown
      |   +-- ucrInputFactorLevels         # Factor level editor
      |   +-- ucrInputConfidenceLimit      # Confidence interval input
      +-- ucrCheck                         # Checkbox control
      +-- ucrNud                           # Numeric up/down spinner
      +-- ucrRadio                         # Radio button group
      +-- ucrDataFrame                     # Dataframe selector
      +-- ucrFactor                        # Factor variable handling
      +-- ucrFilter                        # Data filter control
      +-- ucrCalculator                    # Expression calculator
      +-- ucrGeom                          # ggplot2 geom selector
      |   +-- ucrLayerParameters           # Layer parameter controls
      |   +-- UcrGeomListWithAes           # Geom list with aesthetics
      +-- ucrAdditionalLayers              # Multi-layer management
      +-- ucrReorder                       # Reordering control
      +-- ucrDistributions                 # Statistical distribution selector
      +-- ucrSave                          # Save options control
      +-- ucrPanel                         # Panel with linked radio buttons
      +-- ... (~50+ more specialized controls)
```

### Grid Control Inheritance

```
System.Windows.Forms.UserControl
  +-- ucrReoGrid [MustInherit]             # Abstract base for ReoGrid controls
  |   +-- ucrDataViewReoGrid              # Main data spreadsheet
  |   +-- ucrColumnMetadataReoGrid        # Column metadata display
  |   +-- ucrDataframeMetadataReoGrid     # Dataframe metadata display
  |
  +-- ucrLinuxGrid [MustInherit]           # Abstract base for Linux grids
      +-- (platform-specific implementations)
```

### R Code Structure Inheritance

```
RCodeStructure [base class]                # Abstract R command representation
  +-- RFunction                            # function(param1=val1, param2=val2)
  +-- ROperator                            # left <op> right (e.g., x <- 10)
```

### Form Inheritance

All 627 dialogs, 170 sub-dialogs, and 18 forms inherit directly from `System.Windows.Forms.Form`. There is no custom intermediate base form class - instead, shared behavior comes from **composition** with `ucrButtons` and `ucrCore`-derived controls.

---

## Interface Definitions and Contracts

Four interfaces in `/instat/Interface/` define the grid abstraction layer:

### IGrid
Primary interface for all grid implementations. Defines core data display operations.

### IDataViewGrid
Extends grid behavior for the main data spreadsheet view.

**Key Events**:
- `CellDataChanged` - User edited a cell
- `ReplaceValueInData` - Value replacement request
- `PasteValuesToDataframe` - Clipboard paste
- `DeleteValuesToDataframe` - Cell deletion
- `EditCell` - Cell edit initiated
- `FindRow` - Row search
- `WorksheetChanged` / `WorksheetInserted` / `WorksheetRemoved` - Sheet operations

### IColumnMetaDataGrid
Contract for column metadata display. Events: `EditValue`, `DeleteLabels`.

### IDataframeMetaDataGrid
Contract for dataframe-level metadata display. Events: `EditValue`.

**Implementation Pattern**: The `MustInherit` base classes (`ucrReoGrid`, `ucrLinuxGrid`) implement these interfaces, allowing the application to swap grid implementations by platform (ReoGrid for Windows, alternative for Linux).

**Electron correlation**: The Electron app uses AG Grid directly without an abstraction layer, since it targets all platforms with a single web-based grid.

---

## R Integration Layer

### clsRLink - The R Bridge

**File**: `instat/clsRLink.vb`

This is the central class that bridges VB.NET and R. It manages the R engine lifecycle and all communication.

**Key Fields**:
```
clsEngine As REngine              # R.NET engine instance (in-process R)
strInstatDataObject As String     # = "data_book" (R-side data container name)
bREngineInitialised As Boolean    # Engine ready flag
bRCodeRunning As Boolean          # Execution lock flag
```

**Engine Lifecycle**:
1. Detects R installation (bundled in `static/R/` or system-installed)
2. Validates R version (requires 4.4.3)
3. Initializes REngine via R.NET library
4. Runs `Rsetup.R` to set up the R environment
5. Creates `data_book` object (R6 class) in R global environment

**Command Execution**:
```
RunScript(strScript, iCallType, strComment)
  |-- Validates script syntax (strips comments, checks completeness)
  |-- Routes based on iCallType:
  |     0 = ignore output
  |     1 = capture to temp variable
  |     2 = text output
  |     3 = graph output
  |     4 = special handling
  |-- Executes via REngine.Evaluate()
  |-- Logs to OutputLogger and script window
  |-- Manages background thread for long operations
  |-- Shows wait dialog after 2-second delay
```

**Data Access Methods**:
- `GetDataFrameNames()` - List all loaded dataframes
- `GetColumnNames(strDataFrame)` - Get columns for a dataframe
- `GetColumnType()` - Get column data type
- `DataFrameExists()` - Check dataframe existence
- `GetDataFrameLength()` / `GetDataFrameColumnCount()`
- `GetLinkedToDataFrameNames()` - Dataframe relationships
- `GetFilterNames()` - Active filters
- `FillColumnNames()` - Populate UI controls from R

**Electron correlation**: `clsRLink` maps to the combination of `RService` (facade), `r-bridge.ts` (process manager), and `bridge.R` (command router) in the Electron app. The key architectural difference is that VB.NET uses **in-process** R via R.NET (direct memory access, synchronous), while Electron uses a **child process** with JSON-over-stdio (serialized, async).

---

## R Code Generation Framework

The R code generation system is a hierarchical builder pattern for constructing type-safe R commands. This is one of the most architecturally significant subsystems.

### Class Hierarchy

```
RCodeStructure                     # Base class - abstract R command
  |-- strAssignTo                  # Optional assignment target (x <- ...)
  |-- strAssignToColumn/DataFrame  # Optional data column assignment
  |-- bExcludeAssign               # Skip assignment in output
  |-- iCallType                    # Output handling mode
  |-- lstParameters As List(Of RParameter)
  |
  |-- Overridable ToScript()       # Generate R code string
  |-- AddParameter()               # Add named parameter
  |-- RemoveParameter()            # Remove parameter
  |-- GetParameter()               # Retrieve parameter
  |-- ContainsParameter()          # Check parameter existence
  |-- Clone()                      # Deep copy
  |-- Clear() / ClearParameters()  # Reset state

RFunction (Inherits RCodeStructure)
  |-- strRCommand As String        # Function name (e.g., "ggplot")
  |-- strPackageName As String     # Package (e.g., "ggplot2")
  |-- ToScript() produces:        # "ggplot2::ggplot(data=df, aes(x=col1))"

ROperator (Inherits RCodeStructure)
  |-- strOperation As String       # Operator symbol (+, -, <-, |>, etc.)
  |-- bBrackets As Boolean         # Wrap in parentheses
  |-- bSpaceAroundOperation        # Formatting control
  |-- ToScript() produces:        # "x <- function(y)"
```

### RParameter - Parameter Abstraction

```
RParameter
  |-- strArgumentName As String          # Parameter name (e.g., "data")
  |-- strArgumentValue As String         # String value (e.g., "\"mydf\"")
  |-- clsArgumentCodeStructure           # Nested RFunction or ROperator
  |-- bIsString / bIsFunction / bIsOperator  # Type flags
  |-- iPosition As Integer               # Ordering in function call
  |-- bIncludeArgumentName As Boolean    # Include "name=" in output
```

Parameters can hold **string values**, **nested RFunction calls**, or **nested ROperator expressions**, enabling arbitrarily deep R command trees.

### RSyntax - Complete Script Aggregator

```
RSyntax
  |-- clsBaseFunction As RFunction       # Main R function to execute
  |-- clsBaseOperator As ROperator       # Alternative: operator expression
  |-- strCommandString As String         # Alternative: raw R string
  |-- bUseBaseFunction / bUseBaseOperator / bUseCommandString  # Mode flags
  |-- iCallType As Integer               # Output handling mode
  |
  |-- lstBeforeCodes As List(Of RCodeStructure)  # Setup scripts (run first)
  |-- lstAfterCodes As List(Of RCodeStructure)   # Cleanup scripts (run last)
  |
  |-- GetScript() produces:
  |     1. All before codes
  |     2. Base function/operator/string
  |     3. All after codes
```

### Example: Building an R Command

```vb
' Build: data_book$import_data(data_tables=list(df=read.csv("file.csv")))
Dim clsImport As New RFunction
clsImport.SetRCommand("data_book$import_data")

Dim clsList As New RFunction
clsList.SetRCommand("list")

Dim clsReadCSV As New RFunction
clsReadCSV.SetRCommand("read.csv")
clsReadCSV.AddParameter("x", Chr(34) & "file.csv" & Chr(34))

clsList.AddParameter("df", clsRFunctionParameter:=clsReadCSV)
clsImport.AddParameter("data_tables", clsRFunctionParameter:=clsList)

' Result: data_book$import_data(data_tables=list(df=read.csv("file.csv")))
```

**Electron correlation**: This maps directly to the `r-codegen/` layer in the Electron app. `RFunction` maps to `RFunction` class, `ROperator` maps to `ROperator`, `RParameter` maps to `RParameter`, and `RSyntax` maps to `RSyntax`. The Electron port faithfully reproduces this hierarchy in TypeScript.

---

## Dialog System and Lifecycle

### Dialog Lifecycle Pattern

Every dialog follows this standardized lifecycle:

```
1. Menu Click (frmMain)
   +-- mnuPrepare_SomeOperation_Click()
   +-- dlgSomeOperation.ShowDialog()        # Modal - blocks frmMain

2. Dialog Load Event
   +-- InitialiseDialog()                   # One-time setup
   |   +-- Set help topic ID
   |   +-- Configure control-to-parameter mappings
   |   +-- Set up linked controls and conditions
   +-- SetDefaults()                        # Initialize R code objects
   |   +-- Create RFunction/ROperator instances
   |   +-- Set default parameter values
   |   +-- Set base function on ucrButtons.clsRsyntax
   +-- SetRCodeForControls(bReset:=True)    # Bind controls to R code
       +-- Each control.SetRCode(clsFunction, bReset)

3. User Interaction
   +-- Control value changes fire ControlValueChanged events
   +-- Controls auto-update their mapped R parameters
   +-- Linked controls enable/disable based on conditions

4. OK Button Click (ucrButtons)
   +-- RaiseEvent BeforeClickOk()           # Pre-execution hook
   +-- Scripts(bRun:=True)                  # Execute R code
   |   +-- Collect before codes from RSyntax
   |   +-- Execute base function/operator
   |   +-- Collect after codes from RSyntax
   |   +-- clsRLink.RunScript() for each
   +-- RaiseEvent ClickOk()                 # Post-execution hook
   +-- ParentForm.Close()                   # Close dialog

5. Post-Dialog (back in frmMain)
   +-- DataBook refreshes dataframes from R
   +-- Grids update to reflect changes
   +-- Output window shows results
```

### Dialog Configuration Example (dlgEdit.vb)

```vb
Private Sub InitialiseDialog()
    ucrBase.iHelpTopicID = 699
    ucrSelectValues.SetParameter(New RParameter("data_name", 0))
    ucrReceiverName.SetParameter(New RParameter("column_name", 1))
End Sub

Private Sub SetDefaults()
    clsReplaceValue = New RFunction
    clsReplaceValue.SetRCommand(frmMain.clsRLink.strInstatDataObject & "$replace_value_in_data")
    clsReplaceValue.AddParameter("data_name", ...)
    ucrBase.clsRsyntax.SetBaseRFunction(clsReplaceValue)
End Sub

Private Sub SetRCodeForControls(bReset As Boolean)
    ucrSelectValues.SetRCode(clsReplaceValue, bReset)
End Sub
```

### ucrButtons - Dialog Execution Engine

`ucrButtons` is the standard bottom bar on every dialog, providing OK, Cancel, Reset, and "To Script" buttons. It owns the `RSyntax` instance and orchestrates script execution.

**Key behaviors**:
- **OK**: Executes R scripts then closes dialog
- **To Script**: Sends R code to script window without executing
- **Reset**: Calls `SetDefaults()` + `SetRCodeForControls(bReset:=True)`
- **Cancel**: Closes without executing
- **BeforeClickOk event**: Allows dialogs to add last-minute modifications

### Sub-Dialogs (sdg*)

Sub-dialogs are secondary modal dialogs opened from within a primary dialog. They typically modify a subset of the parent dialog's R parameters (e.g., `sdgLayerOptions` modifies ggplot layer parameters within a plot dialog).

**Electron correlation**: Each `dlg*` class maps to a dialog component in `electron-app/src/app/features/dialogs/`. The `ucrButtons` pattern maps to `DialogBase` class with its `execute()` method and `DialogRCodeManager` service.

---

## Control Architecture

### ucrCore - The Foundation

**File**: `instat/ucrCore.vb`

Every R-aware control inherits from `ucrCore`, which provides the bridge between UI state and R parameters.

**Protected State**:
```
lstAllRCodes As List(Of RCodeStructure)     # Associated R commands
lstAllRParameters As List(Of RParameter)    # Associated R parameters
clsRSyntax As RSyntax                        # Complete script reference
```

**Overridable Methods** (Template Method pattern):
```
UpdateControl()          # Refresh UI from model state
SetControlValue()        # Set control value programmatically
UpdateLinkedControls()   # Cascade changes to dependent controls
UpdateRCode()            # Push UI value to R parameter
SetRCode()               # Bind control to RCodeStructure
SetRSyntax()             # Bind control to RSyntax
GetValueToSet()          # Extract current value for R parameter
CanUpdate()              # Check if control should update
SetRDefault()            # Apply default R value
SetText()                # Set display text
SetParameter()           # Configure R parameter mapping
GetParameterName()       # Get mapped parameter name
```

**Public Events**:
```
ControlValueChanged(ucrChangedControl)      # Value changed by user
ControlContentsChanged(ucrChangedControl)   # Content structure changed
ControlClicked()                             # Control was clicked
```

### Selector-Receiver Pattern

The **Selector-Receiver** pattern is the primary mechanism for column selection across all dialogs:

```
+-------------------+          +-------------------+
|   ucrSelector     |  feeds   |   ucrReceiver     |
|   (column list)   | -------> |   (selected cols)  |
+-------------------+          +-------------------+
| Shows available   |          | Accepts dragged/   |
| columns from the  |          | selected columns   |
| active dataframe  |          | Maps to R parameter |
+-------------------+          +-------------------+
```

**Linking**:
```vb
ucrReceiverX.Selector = ucrSelectorMain    ' Receiver knows its data source
ucrReceiverX.SetParameter(New RParameter("x", 0))  ' Maps to R param
```

**Receiver variants**:
- `ucrReceiverSingle` - Accepts exactly one column
- `ucrReceiverMultiple` - Accepts multiple columns (produces `c("col1","col2")`)
- `ucrReceiverExpression` - Accepts expressions/formulas

### ucrPanel - Radio Button Groups with R Conditions

`ucrPanel` manages groups of radio buttons where each option maps to a different R function or parameter value:

```vb
ucrPnlOptions.AddRadioButton(rdoOptionA)
ucrPnlOptions.AddRadioButton(rdoOptionB)
ucrPnlOptions.AddFunctionNamesCondition(rdoOptionA, "data_book$method_a")
ucrPnlOptions.AddFunctionNamesCondition(rdoOptionB, "data_book$method_b")
ucrPnlOptions.AddParameterValuesCondition(rdoOptionA, "type", Chr(34) & "a" & Chr(34))
ucrPnlOptions.AddToLinkedControls(ucrInput1, {rdoOptionA}, bNewReceiverIsVisible:=True)
```

This declaratively configures: when `rdoOptionA` is selected, use function `method_a`, set parameter `type="a"`, and show `ucrInput1`.

### Linked Controls

Controls can be linked so that enabling/disabling cascades automatically:

```vb
ucrChkShowTitle.AddToLinkedControls(ucrInputTitle, {True}, bNewReceiverIsVisible:=True)
' When checkbox is checked, show the title input; when unchecked, hide it
```

---

## Data Model Layer

### clsDataBook - Top-Level Container

**File**: `instat/Model/DataFrame/clsDataBook.vb`

Manages the collection of all loaded dataframes. Acts as the VB.NET mirror of the R-side `data_book` object.

```
clsDataBook
  +-- _lstDataFrames As List(Of clsDataFrame)
  +-- _clsDataFrameMetaData As clsDataFrameMetaData
  |
  +-- GetDataFrame(name) -> clsDataFrame
  +-- HideDataFrame(name)
  +-- HasDataChanged() -> Boolean
  +-- RefreshDataFrames()      # Sync with R state
```

### clsDataFrame - Single Dataframe

**File**: `instat/Model/DataFrame/clsDataFrame.vb`

Represents a single R dataframe with metadata and caching for grid display.

```
clsDataFrame
  +-- _strDataFrameName As String
  +-- _RLink As RLink                                    # R bridge reference
  +-- _clsVisibleDataFramePage As clsDataFramePage       # Displayed subset
  +-- _clsColumnMetaData As clsColumnMetaData            # Column info
  +-- _clsFilterOrColumnSelection As clsDataFrameFilter  # Active filters
  |
  +-- DisplayedData(iRow, iColumn) -> Object    # Cell value accessor
  +-- DisplayedRowNames() -> String()           # Row identifiers
  +-- RefreshData()                             # Reload from R
```

### clsDataFramePage - Pagination

Holds data for the currently visible page of a dataframe. Enables efficient display of large datasets without loading everything into VB.NET memory.

**Electron correlation**: `clsDataBook` maps to `AppStateService.dataframes` signal. `clsDataFrame` maps to the data preview cache. The Electron app uses `getDataPreview()` with pagination parameters, similar to `clsDataFramePage`.

---

## Grid and Spreadsheet System

### clsGridLink - Grid Management

**File**: `instat/clsGridLink.vb`

Coordinates between the data model and the grid UI control:

```
clsGridLink
  +-- ucrDataViewer As ucrDataView              # Main data grid
  +-- grdData As ReoGridControl                  # Data spreadsheet
  +-- grdMetadata As ReoGridControl              # Metadata grid
  +-- grdVariablesMetadata As ReoGridControl     # Column metadata grid
  +-- iMaxRows As Integer = 1000                 # Display row limit
  +-- iMaxCols As Integer = 30                   # Display column limit
```

### Grid Abstraction via Interfaces

The grid system uses interfaces to abstract the grid implementation, allowing platform-specific grid controls:

```
IGrid (base interface)
  +-- IDataViewGrid          # Data display grid
  |     Events: CellDataChanged, PasteValues, DeleteValues, EditCell, FindRow
  |     Events: WorksheetChanged, WorksheetInserted, WorksheetRemoved
  +-- IColumnMetaDataGrid    # Column metadata grid
  |     Events: EditValue, DeleteLabels
  +-- IDataframeMetaDataGrid # Dataframe metadata grid
        Events: EditValue
```

**Implementation**: `ucrReoGrid` (MustInherit) provides the Windows implementation using the unvell.ReoGrid third-party control. `ucrLinuxGrid` (MustInherit) provides an alternative for Linux. Concrete subclasses (`ucrDataViewReoGrid`, etc.) implement the specific interfaces.

**Electron correlation**: The Electron app uses AG Grid directly. The abstraction layer (`IGrid` interfaces) is unnecessary in the web context since AG Grid works cross-platform.

---

## Output and Logging System

### clsOutputLogger - Central Output Hub

**File**: `instat/Model/Output/clsOutputLogger.vb`

Manages all R script output and display:

```
clsOutputLogger
  +-- _outputElements As List(Of clsOutputElement)
  +-- _filteredOutputs As List(Of clsOutputList)
  |
  +-- AddOutput(code, output, type)
  |
  +-- Events:
      +-- NewOutputAdded()                     # New output element created
      +-- NewFilteredListAdded()               # New filtered list created
      +-- NewOutputAddedToFilteredList()        # Output added to filter
```

### clsOutputElement - Individual Output

Represents a single execution result:
- R script that was executed
- Output data (text, HTML, image path)
- Output type (Script, TextOutput, ImageOutput, HTML, Graph)

### Output Display Chain

```
R Execution completes
  --> clsRLink captures output
  --> clsOutputLogger.AddOutput()
  --> Event: NewOutputAdded
  --> ucrOutputPages receives event
  --> ucrOutputPage displays content
      +-- ucrTextViewer (for text/HTML)
      +-- ucrImageViewer (for graphs/images)
      +-- frmMaximiseOutput (fullscreen view)
```

**Electron correlation**: Maps to the `Output` component and `RService.outputHistory` in the Electron app.

---

## Event-Driven Patterns

The application uses extensive event-driven communication for loose coupling between components:

### Control Events (ucrCore hierarchy)

| Event | Source | Purpose |
|---|---|---|
| `ControlValueChanged` | All ucr* controls | User changed a control value |
| `ControlContentsChanged` | All ucr* controls | Content structure changed |
| `ControlClicked` | All ucr* controls | Control received click |
| `SelectionChanged` | ucrReceiver | Column selection changed |
| `ValueChanged` | ucrReceiver | Receiver value updated |
| `DataFrameChanged` | ucrSelector | Active dataframe changed |
| `ResetAll` | ucrSelector | Full reset requested |
| `NameChanged` | ucrInput | Input name changed |
| `GeomChanged` | ucrGeom | ggplot geom type changed |
| `FilterChanged` | ucrFilter | Filter criteria changed |
| `NumberOfLayersChanged` | ucrAdditionalLayers | Plot layer count changed |
| `OrderChanged` | ucrReorder | Item order changed |
| `DistributionsIndexChanged` | ucrDistributions | Distribution selection changed |

### Dialog Button Events

| Event | Source | Purpose |
|---|---|---|
| `BeforeClickOk` | ucrButtons | Pre-execution hook |
| `ClickOk` | ucrButtons | Post-execution notification |
| `ClickReset` | ucrButtons | Reset requested |
| `ClickClose` | ucrButtons | Dialog closing |

### Grid Events (Interface-defined)

| Event | Source | Purpose |
|---|---|---|
| `CellDataChanged` | IDataViewGrid | Cell edited by user |
| `PasteValuesToDataframe` | IDataViewGrid | Clipboard paste |
| `DeleteValuesToDataframe` | IDataViewGrid | Cell content deleted |
| `WorksheetChanged` | IDataViewGrid | Active sheet changed |
| `EditValue` | IColumnMetaDataGrid | Metadata cell edited |

### Output Events

| Event | Source | Purpose |
|---|---|---|
| `NewOutputAdded` | clsOutputLogger | New output to display |
| `NewFilteredListAdded` | clsOutputLogger | New filtered view |
| `NewOutputAddedToFilteredList` | clsOutputLogger | Output added to filter |

### Event Binding Patterns

**Declarative (WithEvents)**:
```vb
Private WithEvents ucrSelector As ucrSelectorByDataFrame
' Automatically binds to events via Handles keyword
Private Sub ucrSelector_DataFrameChanged() Handles ucrSelector.DataFrameChanged
```

**Dynamic (AddHandler)**:
```vb
AddHandler ucrReceiver.SelectionChanged, AddressOf OnSelectionChanged
```

**Electron correlation**: Events map to Angular's signal-based reactivity system. `ControlValueChanged` maps to signal `effect()` and `computed()`. `WithEvents` + `Handles` maps to Angular template event bindings. The Electron app eliminates explicit event wiring via reactive signals.

---

## Dependency Management and Service Locator

### Service Locator Pattern via frmMain

The application uses `frmMain` as a **service locator**. All shared services are public fields on the main form, accessed globally:

```vb
' Any dialog can access services via:
frmMain.clsRLink          ' R environment interface
frmMain.clsDataBook       ' Data model
frmMain.clsGrids          ' Grid management
frmMain.clsOutputLogger   ' Output logging
frmMain.clsInstatOptions  ' Application settings
frmMain.clsRecentItems    ' Recent files/dialogs
```

This is **not** constructor injection or property injection in the DI sense. Instead, dialogs directly reference `frmMain` (the global application form instance) to access services. This creates tight coupling to the main form but simplifies access patterns.

### Initialization Flow

```
Application.OnCreateMainForm()
  --> frmMain created
  --> frmMain.Load:
      --> clsInstatOptions = LoadFromBinary("Options.bin")
      --> clsRLink = New RLink
      --> clsRLink.StartREngine()
      --> clsOutputLogger = New clsOutputLogger
      --> clsDataBook = New clsDataBook
      --> clsGrids = New clsGridLink
      --> Wire up event handlers between services
      --> Enable menus
```

**Electron correlation**: The service locator pattern via `frmMain` maps to Angular's dependency injection container. `frmMain.clsRLink` maps to injected `RService`, `frmMain.clsDataBook` maps to injected `AppStateService`, etc. Angular DI provides the same access pattern but with testability, type safety, and lifecycle management.

---

## Configuration and Options

### InstatOptions

**File**: `instat/clsInstatOptions.vb`

Serializable class holding all application preferences:

```vb
<Serializable()> Public Class InstatOptions
    ' Appearance
    Public fntOutput, fntScript, fntComment, fntEditor As Font
    Public clrOutput, clrScript, clrComment, clrEditor As Color

    ' Behavior
    Public bIncludeCommentDefault As Nullable(Of Boolean)
    Public bCommandsinOutput As Nullable(Of Boolean)
    Public bAutoSaveData As Nullable(Of Boolean)
    Public bSwitchOffUndo As Nullable(Of Boolean)

    ' Data Display
    Public iPreviewRows, iMaxRows, iMaxWidth, iMaxCols As Nullable(Of Integer)

    ' Menu Visibility
    Public bShowClimaticMenu, bShowTricotMenu, bShowProcurementMenu As Boolean

    ' Database (Climsoft)
    Public strClimsoftDatabaseName, strClimsoftHost, strClimsoftPort As String

    ' System
    Public strWorkingDirectory, strLanguageCultureCode As String
End Class
```

**Storage**: Binary serialization to `AppData/RInstat/Options.bin`. Uses `Nullable(Of T)` types so unset options fall back to defaults defined in `clsInstatOptionsDefaults.vb`.

**Electron correlation**: Maps to `AppStateService.preferences` signal and Electron's `electron-store` for persistence.

---

## Threading and Async Execution

### R Execution Threading Model

R code runs on a **background thread** to prevent UI blocking:

```
Dialog clicks OK
  --> ucrButtons.Scripts(bRun:=True)
  --> clsRLink.RunScript(strScript)
      --> Check bRCodeRunning flag (busy wait with Thread.Sleep(5))
      --> Set bRCodeRunning = True
      --> Spawn background thread
      --> Thread: clsEngine.Evaluate(script)
      --> After 2-second delay: show wait dialog (optional)
      --> Thread completes
      --> Capture output
      --> Set bRCodeRunning = False
      --> Return to caller
```

**Key points**:
- Modal dialogs block the main form but background R execution prevents complete UI freeze
- `bRCodeRunning` flag acts as a simple mutex
- Wait dialog has configurable delay before appearing
- Thread synchronization is manual (no async/await, no Task-based patterns)

**Electron correlation**: The Electron app is **async by default** - R runs in a separate child process and all communication is Promise-based. No explicit threading management needed.

---

## Localization System

### Multi-Language Support

**Languages supported**: English (en), Spanish (es), French (fr), Italian (it), Portuguese (pt), Russian (ru), Swahili (sw-KE)

**Implementation**:
- Each form has `.resx` files for default resources
- Localized variants use culture suffixes: `.sw-KE.resx`, `.fr.resx`, etc.
- `Translations.vb` provides `autoTranslate(Me)` called in each dialog's `Load` event
- `TranslateWinForm` NuGet package handles runtime translation
- `strLanguageCultureCode` in InstatOptions selects active language

**File counts**: ~825 .resx files total across all forms and controls.

---

## Design Patterns Summary

| Pattern | Implementation | Location |
|---|---|---|
| **Service Locator** | `frmMain` holds all shared services as public fields | `frmMain.vb` |
| **Template Method** | `ucrCore` defines overridable methods; subclasses customize | `ucrCore.vb` + all ucr* |
| **Builder** | R commands built incrementally via `RFunction.AddParameter()` | `clsRFunction.vb` |
| **Composite** | `RSyntax` aggregates before/base/after `RCodeStructure` objects | `clsRSyntax.vb` |
| **Command** | R operations encapsulated as `RCodeStructure` objects | `clsRCodeStructure.vb` |
| **Observer** | Events (`ControlValueChanged`, `NewOutputAdded`) for loose coupling | Throughout |
| **Strategy** | `IGrid` interface allows swapping grid implementations | `Interface/` |
| **Abstract Factory** | `ucrReoGrid`/`ucrLinuxGrid` MustInherit bases for platform grids | `UserControls/DataGrid/` |
| **Mediator** | `ucrSelector` mediates between data source and multiple receivers | `ucrSelector.vb` |
| **Facade** | `clsRLink` provides unified interface to R engine | `clsRLink.vb` |

---

## Complete Data Flow

### User Input to R Execution

```
User clicks menu item (frmMain)
  |
  v
frmMain opens dialog via ShowDialog() [modal, blocking]
  |
  v
Dialog.Load --> InitialiseDialog() --> SetDefaults() --> SetRCodeForControls()
  |
  v
User interacts with controls (selects columns, sets options)
  |  Each control fires ControlValueChanged
  |  Controls auto-update their mapped RParameter
  v
User clicks OK (ucrButtons)
  |
  v
RaiseEvent BeforeClickOk [dialogs can add pre-processing]
  |
  v
ucrButtons.Scripts(bRun:=True)
  |  Collects: lstBeforeCodes + clsBaseFunction + lstAfterCodes
  |  Each: RSyntax.GetScript() --> R code string
  v
clsRLink.RunScript(strScript, iCallType)
  |  Validates syntax
  |  Spawns background thread
  |  Thread: REngine.Evaluate(script)
  |  R executes in-process, modifies data_book
  |  Captures output (text/graph/HTML)
  v
clsOutputLogger.AddOutput()
  |  Fires NewOutputAdded event
  v
Output window displays results
  |
  v
Dialog closes (ShowDialog returns to frmMain)
  |
  v
frmMain triggers DataBook refresh
  |  clsDataBook.RefreshDataFrames()
  |  Calls R: names(data_book$data_tables)
  |  Updates clsDataFrame collection
  v
clsGridLink updates ReoGrid controls
  |  Each clsDataFrame.RefreshData()
  |  Grid cells populated from cached data
  v
User sees updated spreadsheet
```

### Visual Architecture Diagram

```
+================================================================+
|                    frmMain (MDI Container)                       |
+================================================================+
| Menu Bar: File | Edit | Prepare | Describe | Model | ...       |
| Toolbar:  [Open] [Save] [Last 10 Dialogs] [Settings]          |
+------------------------+---------------------------------------+
| Data Panel             | Output Panel                          |
|  +--ucrDataViewer      |  +--ucrOutputPages                   |
|  |  (ReoGrid)          |  |  +--ucrOutputPage                 |
|  +--ucrColumnMeta      |  |     +--ucrTextViewer              |
|  +--ucrDataFrameMeta   |  |     +--ucrImageViewer             |
+------------------------+---------------------------------------+
| Script Window (ucrScript)                                      |
+================================================================+
           |                                    ^
           | ShowDialog()                       | Output events
           v                                    |
+============================+     +============================+
|     Dialog (dlg*)          |     |    clsOutputLogger         |
+============================+     +============================+
| +--ucrSelector (columns)   |     | OutputElements list        |
| +--ucrReceiver (selected)  |     | FilteredOutputs list       |
| +--ucrInput (text/combo)   |     | Events: NewOutputAdded     |
| +--ucrCheck (checkboxes)   |     +============================+
| +--ucrPanel (radio groups) |                  ^
| +--sdg* (sub-dialogs)      |                  |
+----------------------------+                  |
| +--ucrButtons              |                  |
|    [OK] [Script] [Reset]   |                  |
+============================+                  |
           |                                    |
           | RSyntax.GetScript()                |
           v                                    |
+============================+                  |
|     R Code Generation      |                  |
+============================+                  |
| RSyntax                    |                  |
|   +--lstBeforeCodes        |                  |
|   +--clsBaseFunction       |                  |
|   |   +--RParameter[]      |                  |
|   +--lstAfterCodes         |                  |
|   +--GetScript() -> String |                  |
+============================+                  |
           |                                    |
           | R code string                      |
           v                                    |
+============================+     +============+===============+
|     clsRLink               |---->| Log script + output       |
+============================+     +============================+
| REngine (R.NET, in-proc)   |
| RunScript()                |
| bRCodeRunning flag         |
| Background thread          |
+============================+
           |
           | Direct memory access
           v
+============================+
|     R Environment          |
+============================+
| data_book (R6 object)      |
|   +--data_tables (list)    |
|   +--metadata              |
|   +--filters               |
| R Packages (dplyr, ggplot2)|
+============================+
```

---

## Correlation with Electron App

### Architectural Comparison

| Aspect | VB.NET | Electron |
|---|---|---|
| **UI Framework** | Windows Forms | Angular 19 + Tailwind/DaisyUI |
| **Language** | VB.NET | TypeScript |
| **R Communication** | In-process via R.NET (direct memory) | Child process via JSON/stdio |
| **State Management** | Service locator via frmMain | Angular DI + Signals |
| **Reactivity** | Manual events (WithEvents, AddHandler) | Automatic signals (computed, effect) |
| **Dialog Pattern** | Modal ShowDialog() blocks UI | Non-blocking modal components |
| **R Code Building** | RFunction/ROperator/RSyntax classes | Identical hierarchy in TypeScript |
| **Grid Control** | ReoGrid (native, abstracted via IGrid) | AG Grid (web-based, direct) |
| **Threading** | Background thread + bRCodeRunning flag | Async/Promise (inherent in IPC) |
| **Serialization** | None (in-process R) | JSON for all R communication |
| **Platform** | Windows only | Windows, macOS, Linux |
| **Dialog Count** | 627 fully implemented | ~32 ported (~5% coverage) |
| **Persistence** | Binary serialization (Options.bin) | electron-store (JSON) |
| **Localization** | .resx files + TranslateWinForm | Angular i18n (planned) |

### Migration Path

The Electron app is designed as a **faithful port** of the VB.NET architecture. Key equivalences:

1. **Every `dlg*` class** should map to a dialog component in `features/dialogs/`
2. **Every `ucr*` control** should map to a shared component in `shared/components/`
3. **The R code generation layer** (`clsRFunction`, `clsROperator`, `clsRParameter`, `clsRSyntax`) has been fully ported to TypeScript with identical semantics
4. **The data model** (`clsDataBook` + `clsDataFrame`) is represented by `AppStateService` signals
5. **The R bridge** (`clsRLink`) is split into `RService` (facade) + `r-bridge.ts` (process) + `bridge.R` (router)

The R backend (`static/InstatObject/R/`) is **shared** between both implementations - the same R6 classes and functions power both the VB.NET and Electron apps.
