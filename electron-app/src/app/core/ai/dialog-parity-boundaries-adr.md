# ADR: DialogBase vs Dialog-Specific Boundaries

## Status

Accepted for parity rollout.

## Context

Ported dialogs need parity with legacy behavior without forcing a one-size-fits-all implementation. Some functionality is shared and regression-prone when duplicated; other logic is inherently domain-specific.

## Decision

### Put in shared base/infrastructure

- Common reactive rebuild wiring:
  - `DialogBase.createRebuildEffect(...)`
- Reusable field reset helper:
  - `DialogBase.resetRegisteredFields(...)`
- Save/restore/metadata workflow:
  - Existing form-field registry and metadata support in `DialogBase`
- Contract consistency checks:
  - `buildParityConsistencyReport()` in AI layer

### Keep dialog-specific

- Statistical/domain semantics:
  - mode-specific variable requirements
  - chart-family-specific options
- Complex option interlocks that are not broadly reusable
- Builder internals that are clearer as targeted, typed implementations

## Consequences

- Fewer regressions from copy/paste lifecycle code.
- Better flexibility retained in individual dialogs.
- Faster parity expansion because cross-cutting failures are caught centrally while domain behavior remains explicit in each dialog.
