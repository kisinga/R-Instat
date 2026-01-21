# Dialog R Code Management Layer

## Overview

The Dialog R Code Management Layer provides a composable, Angular-first abstraction that bridges dialog components with R code generation. It leverages Angular's reactivity (signals), dependency injection, and service architecture to provide an intuitive, type-safe API for building R code from dialog state.

## Architecture Flow

```mermaid
flowchart TD
    Component[Dialog Component<br/>UI State + Signals]
    BuilderService[Dialog Builder Service<br/>Domain Builders]
    CodeManager[Dialog R Code Manager<br/>RSyntax State + Reactivity]
    CodegenCore[R Code Generation Core<br/>Primitives + Composition]
    RService[R Service<br/>Execution + IPC]
    ElectronR[Electron R Bridge<br/>R Process]
    
    Component -->|"1. State Changes"| Component
    Component -->|"2. Read Code<br/>(computed signal)"| CodeManager
    Component -->|"3. Initialize Builder"| CodeManager
    CodeManager -->|"4. Call Builder Function"| BuilderService
    BuilderService -->|"5. Build RSyntax<br/>(composable)"| CodegenCore
    CodegenCore -->|"6. Return RSyntax"| BuilderService
    BuilderService -->|"7. Return RSyntax"| CodeManager
    CodeManager -->|"8. Store in Signal"| CodeManager
    CodeManager -->|"9. toScript()<br/>(generate string)"| CodegenCore
    Component -->|"10. Display Code<br/>(template)"| Component
    Component -->|"11. Execute<br/>(onSubmit)"| CodeManager
    CodeManager -->|"12. Execute Script"| RService
    RService -->|"13. IPC Call"| ElectronR
    ElectronR -->|"14. Result"| RService
    RService -->|"15. Update State"| Component
    
    style Component fill:#e1f5ff
    style BuilderService fill:#fff4e1
    style CodeManager fill:#f0e1ff
    style CodegenCore fill:#e1ffe1
    style RService fill:#ffe1e1
```

## Key Components

### 1. DialogRCodeManager Service

**Location**: `core/dialogs/dialog-r-code-manager.service.ts`

Central service managing RSyntax state per dialog instance. Provides reactive code generation and execution.

**Key Features**:
- RSyntax state management via signals
- Computed code string from RSyntax
- Builder function pattern for automatic updates
- Assignment configuration
- Before/after code management

**Usage**:
```typescript
export class MyDialog extends DialogBase {
  private readonly codeManager = inject(DialogRCodeManager);
  
  readonly rCode = computed(() => this.codeManager.code());
  
  ngOnInit(): void {
    this.codeManager.initialize(() => /* build RSyntax */);
    // Rebuild when state changes
    effect(() => {
      this.selectedDataframe();
      this.rebuildRCode();
    });
  }
}
```

### 2. Dialog Builders

**Location**: `core/dialogs/builders/dialog-builders.ts`

Pure functions providing domain-specific R code builders for dialogs. Builders are composable functions that return RSyntax instances.

**Key Features**:
- Pure functions (no dependency injection needed)
- Type-safe option interfaces
- Composable builder functions returning RSyntax
- Reusable helpers (ggAes, ggBase, etc.)
- `DialogBuilder` type alias for builder function signature

**Usage**:
```typescript
import { buildBarChart } from '@core/dialogs/builders/dialog-builders';

// In component
this.initializeCodeManager(() =>
  buildBarChart({
    dataframe: this.selectedDataframe(),
    xVariable: this.xVariable(),
    position: 'stack',
  })
);
```

**DialogBuilder Type**:
```typescript
import type { DialogBuilder } from '@core/dialogs/builders/types';

// DialogBuilder is a type alias for: () => RSyntax
// Used in DialogBase.initializeCodeManager() and DialogRCodeManager
```

### 3. ggplot2 Helpers

**Location**: `core/r-codegen/ggplot-helpers.ts`

Shared utilities for building ggplot2 layers and aesthetics.

**Functions**:
- `ggAes(mappings)`: Build `aes()` from mappings
- `ggBase(df, aes)`: Build `ggplot(data, aes(...))`
- `ggFacet(by?)`: Build `facet_wrap()` (returns undefined if not needed)
- `ggFlip(flip?)`: Build `coord_flip()` (returns undefined if not needed)
- `ggTheme(name?)`: Build `theme_*()` layers
- `ggLabs(opts)`: Build `labs()` for titles/labels

**Usage**:
```typescript
import { ggBase, ggAes, ggFacet, ggTheme, ggLabs } from '@core/r-codegen';

const code = rPlus(
  ggBase('mydata', ggAes({ x: 'category', y: 'value' })),
  'geom_bar()',
  ggFacet('group'),
  ggTheme(),
  ggLabs({ title: 'My Chart', x: 'Category', y: 'Value' })
);
```

### 4. Column Selection Utilities

**Location**: `core/dialogs/utils/column-selections.ts`

Utilities for managing column selections as composable R code primitives.

**Functions**:
- `columnRef(df, col)`: Returns `rCol(df, col)` - column reference
- `columnsRef(df, cols)`: Array of column references
- `columnVector(cols)`: Returns `c("col1", "col2")` - R vector
- `validateColumnNames(cols)`: TypeScript-level validation

**Usage**:
```typescript
import { columnRef } from '@core/dialogs/utils/column-selections';

const colRef = columnRef('mydata', 'age'); // get_dataframe("mydata")$age
```

## Complete Example: Bar Chart Dialog

### Component

```typescript
import { buildBarChart } from '@core/dialogs/builders/dialog-builders';

export class BarChartDialogComponent extends DialogBase implements OnInit {
  // Dialog state using signals
  xVariable = signal('');
  fillVariable = signal('');
  position = signal<'stack' | 'dodge' | 'fill'>('stack');
  horizontal = signal(false);

  // Reactive R code
  readonly rCode = computed(() => this.codeManager.code());

  ngOnInit(): void {
    super.ngOnInit();

    // Initialize code manager
    this.initializeCodeManager(() =>
      buildBarChart({
        dataframe: this.selectedDataframe(),
        xVariable: this.xVariable(),
        fillVariable: this.fillVariable() || undefined,
        position: this.position(),
        horizontal: this.horizontal(),
      })
    );

    // Auto-rebuild when state changes
    effect(() => {
      this.selectedDataframe();
      this.xVariable();
      this.fillVariable();
      this.position();
      this.horizontal();
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.xVariable();
  }
}
```

### Template

```html
<select [ngModel]="xVariable()" (ngModelChange)="xVariable.set($event)">
  <!-- options -->
</select>

<pre>{{ rCode() }}</pre>

<button (click)="execute()" [disabled]="!isValid()">Execute</button>
```

### Builder

```typescript
buildBarChart(options: BarChartOptions): RSyntax {
  if (!options.dataframe || !options.xVariable) {
    return rSyntax().setBase('# Select required fields');
  }

  return rSyntax()
    .setBase(
      rPlus(
        ggBase(options.dataframe, ggAes({ x: options.xVariable, fill: options.fillVariable })),
        rFn('geom_bar', { position: rStr(options.position || 'stack'), alpha: '0.8' }),
        rIf(options.horizontal, 'coord_flip()'),
        ggTheme(),
        ggLabs({ title: options.title, x: options.xVariable, y: 'Count' })
      )
    )
    .setAssignment(rAssign('graph', options.name || 'bar_chart'));
}
```

## Data Flow

1. **User Interaction** → Component signal updates (e.g., `xVariable.set('category')`)
2. **Signal Change** → Angular detects change, triggers effects/computed
3. **Computed Recalculation** → `rCode()` reads from `codeManager.code()`
4. **Code Manager** → Calls builder function if needed
5. **Builder** → Constructs RSyntax using composable functions
6. **RSyntax** → Stored in code manager's signal
7. **toScript()** → RSyntax converts to R script string
8. **Template** → Displays `{{ rCode() }}` reactively
9. **Execute** → `codeManager.execute(rService)` → R execution
10. **Result** → Component handles success/error, updates UI

## Benefits

1. **Reactivity**: Signals provide automatic reactivity without manual subscriptions
2. **Composability**: Builders are pure functions, easy to test and compose
3. **Type Safety**: Full TypeScript coverage from component to R code
4. **Developer Velocity**: Intuitive API reduces boilerplate by 60-70%
5. **Maintainability**: Clear separation of concerns, single responsibility per service
6. **Testability**: Pure builders and injectable services are easy to unit test
7. **Reusability**: Shared helpers (ggplot, column refs) work across all dialogs

## Migration Guide

### Before (Old Pattern)

```typescript
buildRCode(): string {
  const df = this.selectedDataframe();
  if (!df) return '# Select dataframe';
  
  return `ggplot(get_dataframe("${df}"), aes(x = ${this.xVariable})) +
    geom_bar() +
    theme_minimal()`;
}
```

### After (New Pattern)

```typescript
// Import builder function directly
import { buildBarChart } from '@core/dialogs/builders/dialog-builders';

readonly rCode = computed(() => this.codeManager.code());

ngOnInit(): void {
  this.initializeCodeManager(() =>
    buildBarChart({
      dataframe: this.selectedDataframe(),
      xVariable: this.xVariable(),
    })
  );
  
  effect(() => {
    this.selectedDataframe();
    this.xVariable();
    this.rebuildRCode();
  });
}
```

## Common Patterns

### Pattern 1: Simple Graph Dialog

```typescript
import { buildBarChart } from '@core/dialogs/builders/dialog-builders';

ngOnInit(): void {
  this.initializeCodeManager(() =>
    buildBarChart(options)
  );
  effect(() => { /* track dependencies */; this.rebuildRCode(); });
}
```

### Pattern 2: Dialog with Assignment

```typescript
ngOnInit(): void {
  this.codeManager.initialize(() => /* build syntax */);
  this.codeManager.setAssignment(rAssign('graph', 'my_chart'));
}
```

### Pattern 3: Dialog with Before/After Code

```typescript
ngOnInit(): void {
  this.codeManager.initialize(() => /* base */);
  this.codeManager.addBefore(rFn('library', { package: 'dplyr' }));
  this.codeManager.addAfter(rFn('print', {}));
}
```

## Testing

### Testing Builders

```typescript
import { buildBarChart } from '@core/dialogs/builders/dialog-builders';

describe('buildBarChart', () => {
  it('should build bar chart code', () => {
    const syntax = buildBarChart({
      dataframe: 'mydata',
      xVariable: 'category',
    });
    
    expect(syntax.toScript()).toContain('ggplot');
    expect(syntax.toScript()).toContain('geom_bar');
  });
});
```

### Testing Code Manager

```typescript
describe('DialogRCodeManager', () => {
  let manager: DialogRCodeManager;

  beforeEach(() => {
    manager = new DialogRCodeManager();
  });

  it('should rebuild on initialize', () => {
    manager.initialize(() => rSyntax().setBase('test'));
    expect(manager.code()).toBe('test');
  });
});
```

## Future Enhancements

- [ ] Builder validation helpers
- [ ] Common dataframe operation builders
- [ ] Column type validation utilities
- [ ] Error message generation from validation
- [ ] Code optimization helpers
- [ ] Builder composition utilities
