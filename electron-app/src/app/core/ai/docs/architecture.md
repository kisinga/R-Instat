# Architecture

## Target Model

- `DialogContractV2` is the canonical dialog definition source.
- Legacy consumers (schema registry, operation registry, identity mapping, prompt contracts) are fed via adapters.
- AI prompt context is retrieval-based for ContractV2 dialogs behind a feature flag.
- Resolver normalization is a pluggable pipeline with scoped transforms:
  - global
  - family
  - dialog

## Architecture Progression

### Level 1 - Simple (intent to dialog handoff)

```mermaid
flowchart LR
  U[User Prompt] --> AI[AI Client]
  AI --> IR[Intent Resolver]
  IR --> D[Dialog]
```

### Level 2 - Structured (contract-backed interface layer)

```mermaid
flowchart LR
  U[User Prompt] --> AI[AI Client]
  AI --> IR[Intent Resolver]
  IR --> REG[Operation + Schema Registries]
  REG --> DLG[Dialog Contract Interface]
  DLG --> D[Dialog + Prepopulated Fields]
```

### Level 3 - Current branch shape (governed and extensible)

```mermaid
flowchart LR
  U[User Prompt] --> AI[AI Client Service]
  AI --> CXR[Dialog Context Retriever]
  CXR --> RET[ContractV2 Retrieval]
  RET --> IR[Intent Resolver + Transform Pipeline]
  IR --> ADP[ContractV2 Adapters]
  ADP --> LEG[Legacy Registries<br/>schema + operation + identity]
  IR --> PAR[Parity Check + Evidence]
  PAR --> D[Dialog Selection + Safe Prepopulation]
  LEG --> D
```

## Versioning

- Contract version: implicit `v2` by file/module namespace.
- Migration state is tracked per dialog in `DialogContractV2.migration`.
- Backward compatibility is preserved through adapter outputs until a family is fully migrated.

## Extension Points

- Add new family contracts in `dialog-contract-v2.registry.ts` (or split per family when larger).
- Add retrieval scoring features in `dialog-context-retriever.ts`.
- Register new resolver transforms via `ResolverTransformPipeline` in `intent-resolver.service.ts`.

## Pilot Scope

- Plotting family pilot:
  - `bar-chart`
  - `histogram`
