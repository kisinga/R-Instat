# AI Integration: Logic Flow and Code Areas

This document describes the AI integration from high-level flow down to main code areas and deeper detail. There is **one consistent path**: user prompt → **Categorize** → **Scope** → **Plan/Execute**. Contract and registry are the single way dialogs expose themselves to the AI.

---

## 1. Overview (shallow)

When the user submits a prompt, the system:

1. **Categorizes** the prompt (e.g. open a dialog, refine current dialog, run R code, education question).
2. If the category is **unclear**, the pipeline returns **disambiguation**: the UI shows category-directed suggestions; the user chooses one or rephrases. No Scope or Plan step runs.
3. Otherwise, **Scopes** to a contract set and optional current-dialogue context (using the current-dialogue registry for “refine”).
4. **Plans or executes** using existing AIClientService (LLM or deterministic shortcuts). Plan-level **clarification questions** are directive: each leads to a single clear next step (e.g. choosing a column or confirming an assumption).

Dialogs **register** a descriptor and context with the **current-dialogue registry** when they open and **unregister** when they close. The AI layer never talks to DialogBase or form state directly; it only uses the contract and the registry.

```mermaid
flowchart LR
  subgraph Input
    P[User prompt]
    R[(CurrentDialogueRegistry)]
  end
  subgraph Pipeline
    C[Categorize]
    S[Scope]
    E[Plan / Execute]
  end
  P --> C
  R -->|hasCurrent| C
  C -->|category, family?| S
  R -->|descriptor, context| S
  S -->|contracts, currentContext?, mode| E
  E --> Out[Plan or action]
```

---

## 2. Main code areas

| Area | Location | Responsibility |
|------|----------|----------------|
| **Contract types** | `core/ai/current-dialogue-contract.ts` | `DialogueAIDescriptor`, `DialogueAIContext`, `DialogueAIContract`. The dialogue fulfills this; the registry consumes it. |
| **Registry** | `core/ai/current-dialogue-registry.service.ts` | Single “current” registration. `register(dialogId, contract)`, `unregister(dialogId)`, `getCurrentDescriptor()`, `getCurrentContext()`, `hasCurrent()`. No dependency on dialogs or R codegen. |
| **Adapter** | `core/ai/dialogue-ai-adapters.ts` | `buildDialogueAIContract(input)` — single path to build a contract from plain input (id, name, description, capabilities, getVariables, getRCode). |
| **Layer 1 – Categorizer** | `core/ai/prompt-categorizer.service.ts` | `categorize(userInput, hasCurrentDialog)` → `Promise<{ category, family? }>`. **Compositional:** rule-based strategy first (`categorizer-rules.ts`); when it returns null, LLM is used. Returns `unclear` when the API is unavailable or intent is genuinely ambiguous. |
| **Layer 2 – Scoper** | `core/ai/prompt-scoper.service.ts` | `scope(category, family?, userInput, dataContext, topK)` → `{ contracts, currentDialogContext, executionMode }`. Uses registry for refine path; uses retrieval (optionally family-scoped) for open_dialog. Not called when category is unclear. |
| **Layer 3 – Plan/Execute** | `core/services/ai-client.service.ts` | When category is **unclear**, returns `needsDisambiguation` and `disambiguationSuggestions` (no Scope/Plan). Otherwise: scope → build message → LLM or direct R. Planner context is built from **scoped operations** (only operations whose dialogs are in scope) and **compact contract views** (dialogId, description, operations, paramNames) via `planner-context.ts`; param reference remains the single authority for state keys. Injects current-dialogue context and current category. For **structured codegen**, compiles dialog steps to R via `step-to-r.ts`. |
| **Step-to-R** | `core/ai/step-to-r.ts` | Single adapter: maps AI plan step state (dialogId + schema-shaped state) to existing dialog R builders (buildSort, buildTTest, etc.). Returns builder output script or null. Ensures one source of truth for how each dialog produces R. |
| **Retrieval** | `core/ai/dialog-context-retriever.ts` | `retrieveDialogContractsTopK(userInput, contracts, dataContext, topK, family?)`. Family filter narrows the set before scoring. **Retrieval hints:** catalog entries (from `getDialogContractsForPrompt()`, built from `DialogClassRegistry`) supply `retrievalHints.keywords` for better matching. |
| **Dialog registration** | `dialog-base.ts`, Describe, Import | Single flow: gather input → `buildDialogueAIContract(input)` → `validateDialogueAIContract(contract)` → register only if valid (else console.warn). DialogBase gathers from dialogId, dialogTitle, dialogDescription, dialogCapabilities; Describe/Import build input and use same adapter + validator. Unregister in `ngOnDestroy()`. |

**Single path:** All prompt handling goes through **categorize → scope → plan**. No separate “legacy” contract selection; the scoper is the only producer of the contract set and current context for the planner.

---

## 3. Data flow (deeper)

### 3.1 Dialogue → Registry (registration)

Dialogs are the only writers to the registry. Single flow: build contract via `buildDialogueAIContract(input)`, validate via `validateDialogueAIContract(contract)`, then `registry.register(dialogId, contract)` only if valid; unregister on destroy.

```mermaid
flowchart TB
  subgraph DialogLayer
    DB[DialogBase]
    Desc[DescribeDialogComponent]
    Imp[ImportDialogComponent]
  end
  subgraph Flow
    Build[buildDialogueAIContract]
    Validate[validateDialogueAIContract]
    Reg[CurrentDialogueRegistryService]
  end
  DB -->|gather input| Build
  Desc -->|input| Build
  Imp -->|input| Build
  Build --> Validate
  Validate -->|valid| Reg
```

### 3.2 Pipeline: Categorize → Scope → Plan

AIClientService owns the sequence. It never reads DialogBase or form state; it only uses the registry and the scoper’s output.

```mermaid
flowchart TB
  U[userInput] --> Alias[alias + redact]
  Alias --> Cat[categorize input, registry.hasCurrent]
  Cat -->|unclear| Disambiguation[Return needsDisambiguation + suggestions]
  Disambiguation --> UI1[UI shows category-directed suggestions]
  UI1 -->|user clicks or rephrases| U
  Cat -->|clear category, family| Scope[scoper.scope]
  Reg[(CurrentDialogueRegistry)] -->|getCurrentDescriptor, getCurrentContext| Scope
  DC[dataContext] --> Scope
  Scope -->|contracts, currentDialogContext, executionMode| Plan
  Plan -->|data_quality_recipe?| Recipe[tryBuildDataQualityRecipePlan]
  Plan -->|direct_r?| Direct[generateDirectRScript]
  Plan -->|else| LLM[LLM plan]
  Recipe --> Result[Plan or action]
  Direct --> Result
  LLM --> Result
```

### 3.3 Structured codegen (step-to-R)

When the pipeline produces dialog steps and execution mode is **structured_codegen**, AIClientService compiles each step to R via **`step-to-r.ts`**. The adapter takes `dialogId` and schema-shaped `state`, maps them to the corresponding **dialog R builder** (e.g. `buildSort`, `buildTTest`, `buildRegression`, `buildBarChart`), and returns the builder’s `RSyntax.toScript()` output. If state is incomplete or the builder would emit a placeholder (e.g. “# Select a dataframe first”), the adapter returns null and the step is skipped. This keeps a **single source of truth**: the same builders used by the dialog UI are used for AI-generated plans, so generated R matches dialog behaviour and benefits from any builder option (e.g. t-test alternative/confLevel, regression summary/anova).

### 3.4 Scoper behaviour by category

| Category | Contracts | currentDialogContext | executionMode |
|----------|-----------|----------------------|---------------|
| `refine_current_dialog` | One contract for current dialog (from catalog by descriptor.id), or fallback to open_dialog | From registry | `component_codegen` |
| `open_dialog` | From retrieval over catalog prompt contracts (optionally family-filtered) | `null` | `component_codegen` |
| `run_code` | `[]` | `null` | `direct_r` |
| `education_question` | `[]` | From registry (so model can explain current state) | `component_codegen` |
| `data_quality_recipe` | `[]` | `null` | `component_codegen` |
| `unclear` | Pipeline does not scope; returns `needsDisambiguation: true` and `disambiguationSuggestions` for the UI. User chooses a direction or rephrases. | — | — |

### 3.5 Unclear → disambiguation flow

When the categorizer returns **unclear**, AIClientService does **not** call the scoper or planner. It returns immediately with `success: false`, `needsDisambiguation: true`, and `disambiguationSuggestions`: a list of category-directed options (e.g. “Open a dialog”, “Run R code”, “Education question”, “Data quality workflow”, and “Refine current dialog” only when a dialog is open). The AI Assist UI shows these as clickable options; clicking one sends that suggestion’s text as the next user message, so the pipeline runs again and the categorizer typically assigns the corresponding category. Each step thus leads to a clear direction; there is no guessing via heuristics when intent is unclear.

### 3.6 Clarification questions (directive)

Plan-level **clarification questions** (from the planner LLM) are required to be **directive**: each question must have an answer that leads to a single clear next step (e.g. choosing a column, choosing between two analyses, or confirming an assumption). The planner prompt instructs the model to prefer questions with a small, finite set of answers and to avoid open-ended “Can you tell me more?” unless unavoidable. The current intent category is passed into the planner so clarification stays within that path (e.g. for `open_dialog`, ask which dialog/params; for `education_question`, ask which concept).

---

## 4. File map (reference)

| File | Role |
|------|------|
| `current-dialogue-contract.ts` | Contract types and `DialogueContractInput`. |
| `current-dialogue-registry.service.ts` | Registry; contract-only API. |
| `dialogue-ai-adapters.ts` | `buildDialogueAIContract(input)` — single adapter to build contract from plain input. |
| `dialogue-contract-validator.ts` | `validateDialogueAIContract(contract)` — pure validator; gate for registration. |
| `pipeline-types.ts` | `PromptCategory`, `CategorizerResult`, `CategorizerStrategy`. |
| `categorizer-rules.ts` | Rule-based categorizer strategy (pure); evaluated first. |
| `prompt-categorizer.service.ts` | Layer 1: composes rule-based then LLM `categorize()`. |
| `planner-context.ts` | Pure builders: `filterOperationsForScopedDialogs`, `buildPlanningContractViews`. |
| `prompt-scoper.service.ts` | Layer 2: `scope()`; uses registry + retrieval. |
| `dialog-catalog.ts` | Types: `DialogCatalogContract`, `DialogPromptContract`, `DialogFamily`. |
| `dialog-class-registry.ts` | `DialogClassRegistry`: populated by self-registration (each dialog's static block). No hand-maintained list. The dialog host's imports ensure all catalog dialogs load at bootstrap. Catalog is built from it in `dialog-catalog-aggregator.ts`. |
| `dialog-context-retriever.ts` | Retrieval with optional `family` filter. |
| `ai-client.service.ts` | Layer 3: call flow, message building, LLM/direct R. Uses `step-to-r` for structured codegen. |
| `step-to-r.ts` | Adapter: dialogId + state → builder options → builder → script. Single source of truth for template R generation. |
| `dialog-base.ts` | Gather input → build → validate → register (if valid); unregister on destroy. |
| `describe-dialog.component.ts` | Same flow: buildDialogueAIContract + validate → register for Describe. |
| `import-dialog.component.ts` | Same flow: buildDialogueAIContract + validate → register for Import. |

---

## 5. Alignment with existing pieces

- **dialogId:** Same as in `dialog-identity.registry` and host keys; descriptor `id` matches.
- **Catalog / schema:** Built from DialogClassRegistry (self-registration when dialog modules load; see dialog-class-registry.ts and getDialogContractsForPrompt()). Source for prompts and retrieval. The **runtime** contract (current-dialogue registry) is additive: “what is open and what is its context?” Used by the scoper for refine and by the planner when current context is injected.
- **Family:** `DialogFamily` on catalog contracts is used for family-scoped retrieval in the scoper when category is `open_dialog` and family is known.

No duplicate “ways” to choose contracts: the **scoper** is the single place that produces the contract set and current-dialogue context for the plan step.
