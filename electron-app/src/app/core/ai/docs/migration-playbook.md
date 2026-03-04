# Migration Playbook

## Workflow

1. Define/Update parity contract for target dialog.
2. Add `DialogContractV2` entry.
3. Validate adapter outputs:
   - schema
   - operation mappings
   - identity mapping
   - prompt contract
4. Add/Update resolver transforms (global/family/dialog).
5. Add parity evidence entry in `dialog-parity-evidence.registry.ts`.
6. Pass integration checks in CI.

## Family Checklist

- Family naming is explicit (`plotting`, `data-preparation`, etc).
- Shared defaults and normalizations are family-scoped where possible.
- Dialog-specific transforms remain local to that dialog.

## Definition of Done

- ContractV2 present and coherent with host wiring.
- Operation compatibility validated.
- Parity evidence artifact linked and status marked complete/partial.
- Resolver and retrieval tests updated.
- Docs touched in `src/app/core/ai/docs`.
