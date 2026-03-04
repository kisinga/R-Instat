# Dialog Parity Template

Use this template for each dialog before implementing or changing behavior.

## 1) Dialog Identity

- `legacyDialog`: source VB dialog file/class
- `portedDialog`: Angular component path/class
- `dialogId`: shared dialog ID
- `owner`: responsible engineer
- `reviewers`: product + stats + engineering

## 2) Dataset Mapping

| Legacy Concept | Ported Concept | Status | Notes |
|---|---|---|---|
| Dataframe selection | | Exact/Equivalent/Missing/IntentionalDiff | |
| Allowed column types | | Exact/Equivalent/Missing/IntentionalDiff | |
| Auto defaults | | Exact/Equivalent/Missing/IntentionalDiff | |
| Context change reset behavior | | Exact/Equivalent/Missing/IntentionalDiff | |

## 3) Option Mapping

Map every user-facing option, including advanced/sub-options.

| Option | Legacy Behavior | Ported Behavior | Status | Disposition |
|---|---|---|---|---|
| | | | Exact/Equivalent/Missing/IntentionalDiff | Implement / Defer / ApprovedDiff |

## 4) Flow Mapping

Map core lifecycle and logic flow.

| Flow Step | Legacy Behavior | Ported Behavior | Status | Notes |
|---|---|---|---|---|
| Initialize | | | | |
| Dynamic enable/disable | | | | |
| Validation | | | | |
| R code generation | | | | |
| Execute and persist | | | | |
| Restore from metadata | | | | |

## 5) AI Contract Mapping

| Layer | Artifact | Check |
|---|---|---|
| Schema | `dialog-schema.registry.ts` | Params, enum values, `when` conditions aligned with UI/builder |
| Operation | `operation-registry.ts` | Dialog listed under valid operations |
| Identity | `dialog-identity.registry.ts` | `dialogId` resolves to component type |
| Resolver | `intent-resolver.service.ts` | Required/conditional validation works for this dialog |

## 6) Gap Ledger

- `Exact`: same behavior.
- `Equivalent`: different implementation, same user result.
- `Missing`: behavior absent; create issue with severity and target milestone.
- `IntentionalDiff`: approved simplification with sign-off.

Required fields for `Missing` and `IntentionalDiff`:
- `reason`
- `impact`
- `owner`
- `target release` or `approval reference`

## 7) Exit Criteria

- No unresolved `Missing` items with severity `high`.
- Any `IntentionalDiff` has explicit product sign-off.
- Schema/operation/identity parity checks pass.
- Manual acceptance scenarios documented.
