# Dialog Parity Wave Plan

## Tiering Criteria

- **Complexity**: number of conditional options and dynamic rules.
- **Regression Risk**: likelihood of silent feature loss from legacy behavior.
- **AI Contract Coupling**: schema/operation sensitivity for planner correctness.

## Waves

### Wave 1: Core plotting parity

- `bar-chart` (pilot)
- `histogram`
- `boxplot`
- `scatter`
- `line-plot`
- `dot-plot`

Goal:
- Complete dataset/option/flow mapping artifacts.
- Close high-severity `Missing` gaps.
- Align schema/operation mapping with actual behavior.

### Wave 2: Data preparation dialogs

- `filter`
- `calculate`
- `rename`
- `sort`
- `merge`
- `stack`
- `unstack`

Goal:
- Strengthen conditional validation and defaults.
- Ensure metadata restore parity for multi-step data prep.

### Wave 3: Domain-specific climatic dialogs

- `climatic-summary`
- `annual-rainfall`
- `extremes`
- `day-count`
- `spell-lengths`
- `seasonal-summary`
- `missing-report`
- `temperature-summary`
- `inventory-plot`

Goal:
- Preserve role-based auto-population and domain-specific option flows.
- Confirm parity for climatic-specific edge cases.

## Scorecard Seed

| Dialog | Wave | Complexity | Risk | Parity Status |
|---|---|---|---|---|
| bar-chart | 1 | High | High | Completed (core perfection scope: frequency/value) |
| histogram | 1 | Medium | Medium | Completed (core parity) |
| boxplot | 1 | Medium | Medium | Planned |
| scatter | 1 | Medium | Medium | Planned |
| line-plot | 1 | Medium | Medium | Planned |
| dot-plot | 1 | Medium | Medium | Planned |
| filter | 2 | High | High | Planned |
| calculate | 2 | High | High | Planned |
| merge | 2 | High | High | Planned |
| stack | 2 | Medium | Medium | Planned |
| unstack | 2 | Medium | Medium | Planned |
| climatic-summary | 3 | High | High | Planned |
