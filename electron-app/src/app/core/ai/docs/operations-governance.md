# Operations and Governance

## Release-Blocking Checks

- Contract coherence:
  - host dialogs
  - schema entries
  - operation mappings
  - identity mappings
- ContractV2 coherence:
  - V2 dialog has schema/operation/host entries
- Parity evidence:
  - each migrated ContractV2 dialog has a complete evidence artifact entry

## CI Gates

- `dialog-contract.integration.spec.ts`
  - verifies cross-registry coherence
  - verifies ContractV2 pilot coverage
- `dialog-context-retriever.spec.ts`
  - validates retrieval ranking behavior for plotting intents

## Rollback Policy

- Retrieval path is feature-flagged and can be disabled without code rollback.
- Adapter layer keeps legacy registries functional during staged migration.
