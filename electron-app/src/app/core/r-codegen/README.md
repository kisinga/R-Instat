# R Code Generation

Composable pure functions for building R code strings.

## Overview

This module provides a centralized, type-safe way to generate R code from TypeScript. It eliminates duplication of R formatting primitives across dialog components and enables statisticians to work on R code logic independently from UI code.

## Quick Start

```typescript
import { rDf, rFn, rPipe, rPlus, rStr, rIf, rAnd } from '@core/r-codegen';

// Build a dplyr pipeline
const code = rPipe(
  rDf('mydata'),
  rFn('filter', { x: '> 0' }),
  rFn('summarise', { mean_x: 'mean(x, na.rm = TRUE)' })
);
// => get_dataframe("mydata") %>%
//      filter(x = > 0) %>%
//      summarise(mean_x = mean(x, na.rm = TRUE))

// Build a ggplot
const plot = rPlus(
  `ggplot(${rDf('df')}, aes(x = col))`,
  rFn('geom_histogram', { bins: 30 }),
  'theme_minimal()'
);
// => ggplot(get_dataframe("df"), aes(x = col)) +
//      geom_histogram(bins = 30) +
//      theme_minimal()

// Conditional pipeline steps
const hasFilter = true;
const result = rPipe(
  rDf('data'),
  rIf(hasFilter, rFn('filter', { x: '> 0' })),  // Included only if hasFilter is true
  rFn('summarise', { n: 'n()' })
);
```

## API Reference

### Primitives

Functions for converting TypeScript values to R literal strings.

| Function | Description | Example Input | Output |
|----------|-------------|---------------|--------|
| `rStr(s)` | R string literal | `rStr("hello")` | `"hello"` |
| `rBool(b)` | R boolean | `rBool(true)` | `TRUE` |
| `rNum(n)` | Number literal | `rNum(42)` | `42` |
| `rNull()` | R NULL | `rNull()` | `NULL` |
| `rNA()` | R NA | `rNA()` | `NA` |
| `rVec(items, quote?)` | Vector or single | `rVec(['a','b'])` | `c("a", "b")` |
| `rDf(name)` | Dataframe accessor | `rDf('df')` | `get_dataframe("df")` |
| `rCol(df, col)` | Column accessor | `rCol('df','x')` | `get_dataframe("df")$x` |
| `rParams(obj)` | Named params | `rParams({x:1})` | `x = 1` |

### Composition

Higher-order functions for building R expressions and chains.

| Function | Description | Example |
|----------|-------------|---------|
| `rFn(name, params?, pkg?)` | Function call | `rFn('sum', {x:'col'})` => `sum(x = col)` |
| `rPipe(...exprs)` | `%>%` chain | Joins with ` %>%\n  ` |
| `rPlus(...exprs)` | `+` chain (ggplot) | Joins with ` +\n  ` |
| `rAnd(...exprs)` | `&` chain | `rAnd('a', 'b')` => `(a) & (b)` |
| `rOr(...exprs)` | `\|` chain | `rOr('a', 'b')` => `(a) \| (b)` |
| `rIf(cond, expr)` | Conditional | Returns `expr` or `undefined` |
| `rWrap(expr, cond?)` | Wrap in parens | `rWrap('x+y')` => `(x+y)` |

### Key Features

**Falsy filtering**: `rPipe`, `rPlus`, `rAnd`, and `rOr` automatically filter out `undefined`, `false`, `null`, and empty strings. This enables clean conditional composition:

```typescript
// Only includes filter step if condition is true
rPipe(
  rDf('data'),
  rIf(hasStation, rFn('filter', { station: rStr('A') })),
  rFn('summarise', { n: 'n()' })
)
```

**Package prefixes**: Use the third argument of `rFn` for package-qualified calls:

```typescript
rFn('summarise', { n: 'n()' }, 'dplyr')
// => dplyr::summarise(n = n())
```

## Adding a New Dialog

When creating a new dialog that generates R code:

1. **Create a builder file**: `features/dialogs/your-dialog/r-builders.ts`

2. **Import from core**:
   ```typescript
   import { rDf, rFn, rPipe, rStr, rIf } from '@core/r-codegen';
   ```

3. **Define options interface**:
   ```typescript
   export interface YourAnalysisOptions {
     dataframe: string;
     column: string;
     // ... other options
   }
   ```

4. **Export pure builder function**:
   ```typescript
   export function buildYourAnalysis(opts: YourAnalysisOptions): string {
     if (!opts.dataframe || !opts.column) {
       return '# Select required fields';
     }
     
     return rPipe(
       rDf(opts.dataframe),
       rFn('your_function', { col: opts.column })
     );
   }
   ```

5. **Use in component**:
   ```typescript
   import { buildYourAnalysis } from './r-builders';
   
   // In component class
   rCode = computed(() => buildYourAnalysis({
     dataframe: this.selectedDataframe(),
     column: this.selectedColumn()
   }));
   ```

## Testing

The module includes comprehensive tests in `r-codegen.spec.ts`. When adding new functionality:

```typescript
describe('yourNewFunction', () => {
  it('handles basic case', () => {
    expect(yourNewFunction('input')).toBe('expected output');
  });
});
```

Run tests with:
```bash
npm test -- --testPathPattern=r-codegen
```

## Architecture

```
core/r-codegen/
├── primitives.ts    # Atomic R literal formatting
├── compose.ts       # Expression composition functions
├── index.ts         # Barrel export
├── r-codegen.spec.ts # Unit tests
└── README.md        # This file

features/dialogs/
├── climatic/utils/climatic-r-builders.ts  # Climatic analysis R code
├── describe/utils/r-code-builders.ts      # Describe/graph R code
└── filter/filter-r-builders.ts            # Filter R code
```

## Best Practices

1. **Keep builders pure**: No side effects, same inputs always produce same outputs
2. **Validate inputs early**: Return comment strings for invalid inputs
3. **Use `rIf` for conditionals**: Cleaner than if/else around pipeline steps
4. **Prefer `rFn` over string templates**: Type-safe parameter handling
5. **Test R output**: Verify generated code is valid R syntax
