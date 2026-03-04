# Dialog Parity Governance

## Parity Gate (PR-Level)

Each dialog PR must include:

1. Updated parity artifact using `dialog-parity-template.md`.
2. Gap ledger updates for all `Missing` or `IntentionalDiff`.
3. Confirmation that schema/operation/identity consistency checks pass.

## Release Gate

Block release if any of the following is true:

- A high-severity `Missing` item has no approved deferral.
- A planner-facing dialog is not aligned across:
  - `dialog-schema.registry.ts`
  - `operation-registry.ts`
  - `dialog-identity.registry.ts`
- Contract consistency report returns `ok = false`.

## Test Expectations

For any parity-changed dialog:

- Unit/integration checks for schema + operation coherence.
- Validation checks for conditional requirements.
- At least one restore-from-metadata scenario.
- R-code generation sanity for major option branches.

## Gap Classification Policy

- `Exact`: no action.
- `Equivalent`: document rationale once.
- `Missing`: create follow-up issue with owner and milestone.
- `IntentionalDiff`: requires explicit product sign-off reference.

## Observability

- Keep parity scorecard current by wave.
- Track regressions by dialog ID and flow area:
  - dataset mapping
  - option mapping
  - interaction flow
- For scoped parity efforts (for example bar-chart core perfection), record deferred items explicitly as out-of-scope `Missing` entries with milestone targets.
