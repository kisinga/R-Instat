# AI Integration

## Retrieval Strategy

- Feature flag: `AIConfigService.retrievalSettings.useDialogContractRetrieval`
- Current scope: plotting intents only
- Candidate source: `DialogContractV2Registry.getPromptContracts()`
- Ranking: token overlap, retrieval keywords, family intent hints, and active dataframe compatibility
- Fallback: full contract list if retrieval confidence is low

## Logic Flow Progression

### Level 1 - Simple (single-pass intent mapping)

```mermaid
flowchart TD
  A[User Prompt] --> B[Model Infers Operation]
  B --> C[Dialog Opened]
```

### Level 2 - Structured (retrieval + validation)

```mermaid
flowchart TD
  A[User Prompt] --> B[Retrieve Candidate Contracts]
  B --> C[Rank Candidate Dialogs]
  C --> D[Resolve Operation + Parameters]
  D --> E{Valid Contract Match?}
  E -- Yes --> F[Open Dialog + Prepopulate]
  E -- No --> G[Fallback / Ask Clarification]
```

### Level 3 - Current branch flow (governed decision path)

```mermaid
flowchart TD
  A[User Prompt] --> B[Context Retrieval<br/>DialogContextRetriever]
  B --> C[ContractV2 Candidate Ranking]
  C --> D[Intent Resolver]
  D --> E[Transform Pipeline<br/>global -> family -> dialog]
  E --> F{Safety + Compatibility Checks}
  F -- Pass --> G[Parity Check]
  G --> H[Open Dialog + Safe Prepopulation]
  F -- Fail --> I[Warn / Clarify / Fallback]
```

## Resolver Pipeline

- Pipeline implementation: `ResolverTransformPipeline`
- Current modules:
  - global: infer missing fields, normalize column references
  - dialog: filter combine logic, bar-chart state normalization
- Diagnostics: applied transform IDs available from pipeline result

## Safety Constraints

- Resolver validates operation ID, dialog compatibility, and parameter types.
- Code steps are blocked for side-effect patterns (filesystem/system commands).
- Low-confidence steps are surfaced as warnings.
