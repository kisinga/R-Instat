/**
 * AI Client Service (Layer 3: Plan / Execute)
 *
 * Orchestrates the single AI path: Categorize → Scope → Plan. Uses PromptScoperService
 * for contract set and current-dialogue context; no direct contract selection.
 * See core/ai/docs/ai-integration.md for flow and code areas.
 */

import { Injectable, inject } from '@angular/core';
import { AIConfigService } from './ai-config.service';
import { VectorIndexService } from '../vector/vector-index.service';
import { VectorMemoryService } from '../vector/vector-memory.service';
import { OPERATION_REGISTRY } from '../ai/operation-registry';
import { compileStepToR as compileStepToRFromAdapter } from '../ai/step-to-r';
import {
  aliasDataContext,
  applyAliasesToInput,
  buildPrivacyReport,
  deAliasPlan,
  deAliasScript,
  redactUserInput,
} from '../ai/pii-guard';
import { CurrentDialogueRegistryService } from '../ai/current-dialogue-registry.service';
import { PromptScoperService } from '../ai/prompt-scoper.service';
import { PromptCategorizerService } from '../ai/prompt-categorizer.service';
import { getSchema } from '../ai/dialog-catalog-aggregator';
import {
  filterOperationsForScopedDialogs,
  buildPlanningContractViews,
} from '../ai/planner-context';
import type { DialogueAIContext } from '../ai/current-dialogue-contract';
import type { PromptCategory } from '../ai/pipeline-types';

export interface DisambiguationSuggestion {
  text: string;
  category: PromptCategory;
}

export interface DataContext {
  dataframes: string[];
  activeDataframe: string | null;
  columnsByDataframe: Record<string, Array<{ name: string; type: string }>>;
}

export type ExecutionMode = 'component_codegen' | 'structured_codegen' | 'direct_r';

export interface AIBasePlanStep {
  stepId: string;
  dependsOnStepId?: string;
  inferredFields: string[];
  confidence: number;
  rationale?: string;
}

export interface AIDialogPlanStep extends AIBasePlanStep {
  stepType?: 'dialog';
  operationId: string;
  dialogId: string;
  state: Record<string, unknown>;
}

export interface AICodePlanStep extends AIBasePlanStep {
  stepType: 'code';
  executionMode: 'structured_codegen' | 'direct_r';
  script: string;
  expectedOutputs: string[];
  safetyFlags: string[];
  operationId?: string;
  dialogId?: string;
  state?: Record<string, unknown>;
}

export type AIPlanStep = AIDialogPlanStep | AICodePlanStep;

export interface AIPlan {
  goal: string;
  assumptions: string[];
  clarificationQuestions: string[];
  overallConfidence: number;
  requiresConfirmation: boolean;
  executionMode: ExecutionMode;
  modeReason: string;
  modeConfidence: number;
  steps: AIPlanStep[];
}

export interface AICallResult {
  success: boolean;
  plan?: AIPlan;
  error?: string;
  rawResponse?: string;
  /** When true, intent was unclear; UI should show disambiguationSuggestions instead of calling the planner. */
  needsDisambiguation?: boolean;
  /** Category-directed suggestions for the user to choose; only set when needsDisambiguation is true. */
  disambiguationSuggestions?: DisambiguationSuggestion[];
  retrievalReport?: {
    enabled: boolean;
    topK: number;
    selectedDialogIds: string[];
    explainability: Array<{ dialogId: string; score: number; reasons: string[] }>;
  };
  privacyReport?: {
    redactedPatterns: string[];
    aliasedDataframes: number;
    aliasedColumns: number;
  };
}

interface ClaudeResponse {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
}

interface ModeDecision {
  mode: ExecutionMode;
  reason: string;
  confidence: number;
}

/** Fixed suggestion text per category so that re-categorization yields that category. */
const DISAMBIGUATION_SUGGESTION_TEXTS: Record<Exclude<PromptCategory, 'unclear'>, string> = {
  open_dialog:
    'I want to open a dialog (e.g. create a plot, run a test, filter or transform data).',
  refine_current_dialog: 'I want to change or extend the current dialog.',
  run_code: 'I want to run or write R code / a script.',
  education_question: 'I have a question about statistics or how something works.',
  data_quality_recipe: 'I want a data quality or missing-data workflow.',
};

function buildDisambiguationSuggestions(hasCurrentDialog: boolean): DisambiguationSuggestion[] {
  const suggestions: DisambiguationSuggestion[] = [];
  suggestions.push({
    text: DISAMBIGUATION_SUGGESTION_TEXTS.open_dialog,
    category: 'open_dialog',
  });
  if (hasCurrentDialog) {
    suggestions.push({
      text: DISAMBIGUATION_SUGGESTION_TEXTS.refine_current_dialog,
      category: 'refine_current_dialog',
    });
  }
  suggestions.push(
    { text: DISAMBIGUATION_SUGGESTION_TEXTS.run_code, category: 'run_code' },
    { text: DISAMBIGUATION_SUGGESTION_TEXTS.education_question, category: 'education_question' },
    { text: DISAMBIGUATION_SUGGESTION_TEXTS.data_quality_recipe, category: 'data_quality_recipe' }
  );
  return suggestions;
}

/** True if operationId is a real registry id; false for null, undefined, empty, or placeholders like "N/A". */
function isValidOperationId(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return s !== '' && !['n/a', 'none', 'null'].includes(s);
}

@Injectable({ providedIn: 'root' })
export class AIClientService {
  private readonly aiConfig = inject(AIConfigService);
  private readonly currentDialogueRegistry = inject(CurrentDialogueRegistryService);
  private readonly scoper = inject(PromptScoperService);
  private readonly categorizer = inject(PromptCategorizerService);

  // Optional vector services - null if not available
  private readonly vectorIndex = inject(VectorIndexService, { optional: true });
  private readonly vectorMemory = inject(VectorMemoryService, { optional: true });

  private static readonly SYSTEM_PROMPT = `You are an orchestration planner for an R-based statistics app.
Return STRICT JSON only with this shape:
{
  "goal": string,
  "assumptions": string[],
  "clarificationQuestions": string[],
  "overallConfidence": number, // 0..1
  "requiresConfirmation": boolean,
  "executionMode": "component_codegen",
  "modeReason": string,
  "modeConfidence": number, // 0..1
  "steps": [
    {
      "stepId": string,
      "operationId": string, // from operation registry
      "dialogId": string,    // from dialog schema
      "dependsOnStepId": string | null,
      "state": object,       // must match dialog param schema
      "inferredFields": string[],
      "confidence": number,  // 0..1
      "rationale": string
    }
  ]
}

Rules:
- Use only provided operationId and dialogId values.
- Use exact dataframe and column names from data context.
- For each dialogId, use ONLY the param names listed in the "Dialog param names reference" (state keys must match exactly).
- Respect parameter types/required/conditions from schemas.
- Set dependsOnStepId when a step requires output/preparation from a previous step.
- If uncertain, set requiresConfirmation=true and add clarificationQuestions.
- Clarification options (clarificationQuestions): Each item is a **clickable option**; when the user clicks it, that **exact string is sent as the next user message**. So each item MUST be a **short statement of intent** (e.g. "I want to understand one-sample t-tests", "Use column age for the grouping variable"), NOT a question (e.g. do not use "Are you interested in X or Y?"). Otherwise the next turn will be classified as unclear. Keep the same intent category: do NOT use clarification to let the user choose between different categories (e.g. "understand vs perform"). Category is already fixed; only narrow **within** that category (e.g. for education_question: which concept or type to explain; for open_dialog: which column or which dialog param). Prefer few options (2–4) that are clear intent phrases. For clear education intents (e.g. "explain what a t-test tells us"), prefer answering directly with an informational goal; if you must clarify, use only within-education options (e.g. "Explain one-sample t-test", "Explain two-sample t-test", "Explain paired t-test").
- Multi-step plans are allowed when prerequisite transformation is needed.
- For education_question category: return an EMPTY steps array. Put the explanation in the "goal" field. Do NOT invent operationIds or dialogIds for educational content.
- For data quality/effectiveness requests, prefer a composed workflow: summary by group, missing-record filter, calculate quality score, then sort/rank.
- Keep steps minimal and executable.`;

  async call(userInput: string, dataContext: DataContext): Promise<AICallResult> {
    const { context: aliasedContext, maps } = aliasDataContext(dataContext);
    const redacted = redactUserInput(userInput);
    const aliasedInput = applyAliasesToInput(redacted.value, maps);
    const privacyReport = buildPrivacyReport(redacted.patterns, maps);

    // Layer 1: Categorize (LLM-based; falls back to rules if unavailable)
    const { category, family } = await this.categorizer.categorize(
      aliasedInput,
      this.currentDialogueRegistry.hasCurrent()
    );

    if (category === 'unclear') {
      return {
        success: false,
        needsDisambiguation: true,
        disambiguationSuggestions: buildDisambiguationSuggestions(
          this.currentDialogueRegistry.hasCurrent()
        ),
        privacyReport,
      };
    }

    // Layer 2: Scope (with optional vector pre-ranking)
    const settings = this.aiConfig.retrievalSettings();
    const retrievalContext = {
      activeDataframe: aliasedContext.activeDataframe,
      columnsByDataframe: aliasedContext.columnsByDataframe,
    };

    // Pre-fetch vector rankings if available (async, before sync scope call)
    let preRankedCandidates: import('../ai/dialog-context-retriever').PreRankedCandidate[] | undefined;
    if (settings.useDialogContractRetrieval && this.vectorIndex) {
      // Lazily ensure index is built on first use
      await this.vectorIndex.ensureIndexed().catch(() => {});
      try {
        preRankedCandidates = await this.vectorIndex.preRankDialogs(
          aliasedInput,
          settings.topKContracts,
          family
        );
      } catch {
        // Vector search failed - fall back to keyword matching
      }
    }

    const scoped = this.scoper.scope(
      category,
      family,
      aliasedInput,
      retrievalContext,
      settings.topKContracts,
      preRankedCandidates
    );

    const currentDialogId = this.currentDialogueRegistry.getCurrentDescriptor()?.id ?? 'none';
    const scopedDialogIds = scoped.contracts.map((c) => c.dialogId);
    if (typeof console !== 'undefined' && console.info) {
      console.info(
        `[AI] category=${category}, mode=${scoped.executionMode}, contracts=[${scopedDialogIds.join(', ')}], currentDialog=${currentDialogId}`
      );
    }

    const modeDecision: ModeDecision = {
      mode: scoped.executionMode,
      reason: `Pipeline category: ${category}`,
      confidence: 0.85,
    };

    if (modeDecision.mode === 'component_codegen') {
      const recipePlan = this.tryBuildDataQualityRecipePlan(userInput, dataContext);
      if (recipePlan) {
        return { success: true, plan: recipePlan, privacyReport };
      }
    }

    const provider = this.aiConfig.provider();
    const apiKey = this.aiConfig.apiKey();
    if (!apiKey?.trim()) {
      const label = provider === 'claude' ? 'Claude' : 'OpenAI';
      return { success: false, error: `No API key. Add your ${label} API key in Settings.` };
    }

    const retrievalReport = {
      enabled: true,
      topK: settings.topKContracts,
      selectedDialogIds: scoped.contracts.map((c) => c.dialogId),
      explainability: [],
    };
    const scopedOperations = filterOperationsForScopedDialogs(
      OPERATION_REGISTRY,
      scopedDialogIds
    );
    const compactContracts = buildPlanningContractViews(
      scoped.contracts,
      getSchema
    );
    const contractsJson = JSON.stringify(compactContracts);
    const operationsJson = JSON.stringify(scopedOperations);

    // Retrieve similar past interactions for few-shot examples (optional)
    let pastInteractions: Array<{ query: string; dialogId: string; state: Record<string, unknown> }> | undefined;
    if (this.vectorMemory?.isReady()) {
      try {
        const similar = await this.vectorMemory.getSimilarInteractions(aliasedInput, 3);
        if (similar.length > 0) {
          pastInteractions = similar.map(s => ({
            query: s.query,
            dialogId: s.dialogId,
            state: s.state,
          }));
        }
      } catch {
        // Memory retrieval failed - continue without few-shot examples
      }
    }

    const userMessage = this.buildUserMessage(
      aliasedInput,
      aliasedContext,
      operationsJson,
      contractsJson,
      modeDecision.mode,
      scoped.currentDialogContext,
      scopedDialogIds,
      category,
      pastInteractions
    );

    try {
      if (modeDecision.mode === 'direct_r') {
        const script = await this.generateDirectRScript(apiKey, provider, aliasedInput, aliasedContext);
        return {
          success: true,
          plan: this.buildDirectRPlan(
            userInput,
            modeDecision,
            deAliasScript(script, maps)
          ),
          retrievalReport,
          privacyReport,
        };
      }

      const content = provider === 'claude'
        ? await this.callClaude(apiKey, userMessage)
        : await this.callOpenAI(apiKey, userMessage);

      const parsed = this.parseDialogPlanContent(content, userInput, modeDecision, {
        allowEmptySteps: category === 'education_question',
      });
      if (!parsed.success || !parsed.plan) {
        return { ...parsed, privacyReport };
      }

      const normalizedPlan = deAliasPlan(parsed.plan, maps);

      // Guard: education questions should never have steps (strip hallucinated ones)
      if (category === 'education_question' && normalizedPlan.steps.length > 0) {
        normalizedPlan.steps = [];
      }

      if (modeDecision.mode === 'structured_codegen') {
        const structuredPlan = this.buildStructuredCodePlan(normalizedPlan, modeDecision);
        return {
          success: true,
          plan: structuredPlan,
          retrievalReport,
          privacyReport,
        };
      }

      // Record interaction for future few-shot retrieval (fire-and-forget)
      if (this.vectorMemory && normalizedPlan?.steps?.length > 0) {
        const firstStep = normalizedPlan.steps[0];
        if (firstStep.stepType === 'dialog') {
          const dialogStep = firstStep as AIDialogPlanStep;
          this.vectorMemory.recordInteraction(
            userInput, dialogStep.dialogId, dialogStep.operationId,
            (dialogStep.state ?? {}) as Record<string, unknown>,
            true, modeDecision.mode, dialogStep.confidence
          ).catch(() => {});
        }
      }

      return { ...parsed, plan: normalizedPlan, retrievalReport, privacyReport };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const lower = message.toLowerCase();
      const is401 =
        message.includes('401') ||
        message.includes('403') ||
        lower.includes('incorrect api key') ||
        lower.includes('invalid x-api-key');
      const is429 =
        message.includes('429') ||
        lower.includes('quota') ||
        lower.includes('rate limit') ||
        lower.includes('insufficient_quota');
      const provider = this.aiConfig.provider();
      return {
        success: false,
        error: is401
          ? 'Invalid API key. Check your key in Settings.'
          : is429
            ? provider === 'openai'
              ? 'OpenAI quota exceeded (429). Check your OpenAI billing/plan, or switch provider to Claude in AI Assist settings.'
              : 'Claude quota/rate limit reached (429). Check your Anthropic billing/plan, or switch provider to OpenAI in AI Assist settings.'
            : message,
        rawResponse: undefined,
        privacyReport,
      };
    }
  }

  private buildUserMessage(
    userInput: string,
    dataContext: DataContext,
    operationsJson: string,
    contractsJson: string,
    mode: ExecutionMode,
    currentDialogContext?: DialogueAIContext | null,
    scopedDialogIds: string[] = [],
    category?: PromptCategory,
    pastInteractions?: Array<{ query: string; dialogId: string; state: Record<string, unknown> }>
  ): string {
    const inferenceHints = this.buildDataInferenceHints(dataContext);
    const paramReference = this.buildDialogParamReference(scopedDialogIds);
    const currentStateBlock =
      currentDialogContext != null
        ? `\nCurrent dialog state (use this to refine, not invent):\n${JSON.stringify(currentDialogContext)}\n\n`
        : '';
    const categoryBlock =
      category != null && category !== 'unclear'
        ? `\nCurrent intent category: ${category}. Do not offer clarifications that switch category. Any clarificationQuestions must stay within this category and each item must be a short intent statement (what the user is choosing), not a question—that text is sent as the next message.\n\n`
        : '';
    const memoryBlock =
      pastInteractions && pastInteractions.length > 0
        ? `\nSimilar past interactions (for reference, not binding):\n${pastInteractions.map((p, i) => `${i + 1}. "${p.query}" -> dialogId: "${p.dialogId}", state: ${JSON.stringify(p.state)}`).join('\n')}\n\n`
        : '';
    return `Data context:
- dataframes: ${JSON.stringify(dataContext.dataframes)}
- activeDataframe: ${dataContext.activeDataframe ?? 'null'}
- columnsByDataframe: ${JSON.stringify(dataContext.columnsByDataframe)}
- inferenceHints: ${inferenceHints}

Operation registry: ${operationsJson}
Dialog contracts: ${contractsJson}

Dialog param names reference (use ONLY these keys in state for each dialogId; no other keys allowed):
${paramReference}
${currentStateBlock}${categoryBlock}${memoryBlock}User request: ${userInput}
Target execution mode: ${mode}

Privacy note:
- Dataframe and column identifiers are aliased tokens (for example df_1, df_1_col_2).
- Use only identifiers visible in this prompt.

Return the strict JSON plan only.`;
  }

  /**
   * Build a compact reference of dialogId -> param names so the model uses exact schema keys.
   * Only includes dialogs in scope to keep prompt size bounded by topK.
   */
  private buildDialogParamReference(dialogIds: string[]): string {
    if (dialogIds.length === 0) {
      return '(no dialogs in scope)';
    }
    return dialogIds
      .map((dialogId) => {
        const schema = getSchema(dialogId);
        return schema ? `${dialogId}: ${schema.params.map((p) => p.name).join(', ')}` : null;
      })
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  private buildDataInferenceHints(dataContext: DataContext): string {
    const hints = Object.entries(dataContext.columnsByDataframe).map(([df, columns]) => {
      const byType = {
        numeric: columns
          .filter((c) => this.mapColumnType(c.type) === 'numeric')
          .map((c) => c.name)
          .slice(0, 8),
        factor: columns
          .filter((c) => this.mapColumnType(c.type) === 'factor')
          .map((c) => c.name)
          .slice(0, 8),
        date: columns
          .filter((c) => this.mapColumnType(c.type) === 'date')
          .map((c) => c.name)
          .slice(0, 8),
      };

      return {
        dataframe: df,
        preferredRoles: {
          xOrGrouping: byType.factor,
          yOrMeasure: byType.numeric,
          dateAxes: byType.date,
        },
      };
    });
    return JSON.stringify(hints);
  }

  private async callOpenAI(apiKey: string, userMessage: string): Promise<string> {
    if (!window.electronAPI?.ai?.openaiChat) {
      throw new Error(
        'OpenAI requires Electron IPC bridge. Restart the Electron app and open AI Assist inside the Electron window.'
      );
    }
    const response = await window.electronAPI.ai.openaiChat({
      apiKey,
      system: AIClientService.SYSTEM_PROMPT,
      userMessage,
      model: 'gpt-4o-mini',
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error: HTTP ${response.status}`);
    }
    const payload = response.data as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      const reason = payload.error?.message ?? 'Empty response from model';
      throw new Error(reason);
    }
    return content;
  }

  private async callOpenAIFreeText(apiKey: string, userMessage: string): Promise<string> {
    if (!window.electronAPI?.ai?.openaiChat) {
      throw new Error(
        'OpenAI requires Electron IPC bridge. Restart the Electron app and open AI Assist inside the Electron window.'
      );
    }
    const response = await window.electronAPI.ai.openaiChat({
      apiKey,
      system: 'Return only plain R code.',
      userMessage,
      model: 'gpt-4o-mini',
      temperature: 0.1,
      responseFormat: 'text',
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error: HTTP ${response.status}`);
    }
    const payload = response.data as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      const reason = payload.error?.message ?? 'Empty response from model';
      throw new Error(reason);
    }
    return content;
  }

  private async callClaude(
    apiKey: string,
    userMessage: string,
    systemPrompt: string = AIClientService.SYSTEM_PROMPT
  ): Promise<string> {
    if (!window.electronAPI?.ai?.anthropicMessage) {
      throw new Error(
        'Claude requires Electron IPC bridge. Restart the Electron app (not just Angular hot reload) and open AI Assist inside the Electron window.'
      );
    }

    const response = await window.electronAPI.ai.anthropicMessage({
      apiKey,
      system: systemPrompt,
      userMessage,
      model: 'claude-haiku-4-5',
      maxTokens: 1800,
      temperature: 0.2,
    });

    const payload = response.data as ClaudeResponse;
    if (!response.ok) {
      const reason = payload?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Claude API error: ${reason}`);
    }

    const content = (payload.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
    if (!content) {
      throw new Error('Empty response from model');
    }
    return content;
  }

  private parseDialogPlanContent(
    content: string,
    userInput: string,
    modeDecision: ModeDecision,
    options?: { allowEmptySteps?: boolean }
  ): AICallResult {
    try {
      const jsonContent = this.extractJson(content);
      const parsed = JSON.parse(jsonContent) as Partial<AIPlan>;
      const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
      // Drop dialog steps with missing or placeholder operationId (e.g. education_question when model returns N/A or null)
      const steps = rawSteps.filter((s) => {
        if (s.stepType === 'code') return true;
        const opId = (s as AIDialogPlanStep).operationId;
        return isValidOperationId(opId);
      }) as AIPlanStep[];
      const hasClarifications = Array.isArray(parsed.clarificationQuestions) && parsed.clarificationQuestions.length > 0;
      const allowEmptySteps =
        options?.allowEmptySteps === true || (steps.length === 0 && hasClarifications);
      if (!parsed || (!allowEmptySteps && steps.length === 0)) {
        return { success: false, error: 'Invalid response: missing plan steps', rawResponse: content };
      }
      // When allowEmptySteps (e.g. education_question), accept plans that have only informational steps
      // (no operationId). Return success with steps: [] so the UI can show goal, assumptions, and clarification options.
      if (rawSteps.length > 0 && steps.length === 0 && !allowEmptySteps) {
        return {
          success: false,
          error:
            "This request couldn't be matched to a specific analysis. For conceptual questions (e.g. 'What does a t-test tell us?') try asking to run a t-test on your data from the menu, or rephrase as a request to perform an analysis.",
          rawResponse: content,
        };
      }

      return {
        success: true,
        plan: {
          goal: parsed.goal ?? userInput,
          assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
          clarificationQuestions: Array.isArray(parsed.clarificationQuestions) ? parsed.clarificationQuestions : [],
          overallConfidence: typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : 0.5,
          requiresConfirmation: !!parsed.requiresConfirmation,
          executionMode: 'component_codegen',
          modeReason:
            typeof parsed.modeReason === 'string' && parsed.modeReason.trim()
              ? parsed.modeReason
              : modeDecision.reason,
          modeConfidence:
            typeof parsed.modeConfidence === 'number' ? parsed.modeConfidence : modeDecision.confidence,
          steps: steps as AIDialogPlanStep[],
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        rawResponse: content,
      };
    }
  }

  private buildStructuredCodePlan(dialogPlan: AIPlan, modeDecision: ModeDecision): AIPlan {
    const steps: AICodePlanStep[] = [];
    for (const step of dialogPlan.steps) {
      if (step.stepType === 'code') {
        continue;
      }
      const script = this.compileStepToR(step);
      if (!script) {
        continue;
      }
      steps.push({
        stepType: 'code',
        stepId: `${step.stepId}-code`,
        dependsOnStepId: step.dependsOnStepId ? `${step.dependsOnStepId}-code` : undefined,
        executionMode: 'structured_codegen',
        script,
        expectedOutputs: [`Result of ${step.dialogId}`],
        safetyFlags: ['template_compiled'],
        operationId: step.operationId,
        dialogId: step.dialogId,
        state: step.state,
        inferredFields: step.inferredFields,
        confidence: Math.max(0.55, step.confidence - 0.05),
        rationale: step.rationale,
      });
    }

    if (steps.length === 0) {
      return {
        ...dialogPlan,
        executionMode: 'component_codegen',
        modeReason: 'Structured templates unavailable for generated steps; fallback to component mode.',
        modeConfidence: 0.6,
      };
    }

    return {
      ...dialogPlan,
      executionMode: 'structured_codegen',
      modeReason: modeDecision.reason,
      modeConfidence: modeDecision.confidence,
      steps,
    };
  }

  private compileStepToR(step: AIDialogPlanStep): string | null {
    return compileStepToRFromAdapter(step.dialogId, step.state ?? {});
  }

  private async generateDirectRScript(
    apiKey: string,
    provider: 'openai' | 'claude',
    userInput: string,
    dataContext: DataContext
  ): Promise<string> {
    const systemPrompt = 'You are an R analyst. Return only executable R code with no markdown fences.';
    const prompt = `Rules: do not use file/network/system commands. Use existing dataframes/columns only.
Data context: ${JSON.stringify(dataContext)}
Request: ${userInput}`;

    const content = provider === 'claude'
      ? await this.callClaude(apiKey, prompt, systemPrompt)
      : await this.callOpenAIFreeText(apiKey, prompt);
    return content.trim();
  }

  private buildDirectRPlan(userInput: string, modeDecision: ModeDecision, script: string): AIPlan {
    return {
      goal: userInput,
      assumptions: ['Direct script generated for uncovered or advanced intent.'],
      clarificationQuestions: [],
      overallConfidence: 0.68,
      requiresConfirmation: true,
      executionMode: 'direct_r',
      modeReason: modeDecision.reason,
      modeConfidence: modeDecision.confidence,
      steps: [
        {
          stepType: 'code',
          stepId: 'direct-r-1',
          executionMode: 'direct_r',
          script,
          expectedOutputs: ['R console output and/or generated objects'],
          safetyFlags: ['requires_review', 'llm_direct'],
          inferredFields: ['script'],
          confidence: 0.68,
          rationale: 'Direct R generated for capability gap.',
        },
      ],
    };
  }

  private tryBuildDataQualityRecipePlan(userInput: string, dataContext: DataContext): AIPlan | null {
    const text = userInput.toLowerCase();
    const qualityKeywords = ['gap', 'gaps', 'inconsisten', 'missing', 'completeness', 'quality', 'effectiveness'];
    const hasQualityIntent = qualityKeywords.some((k) => text.includes(k));
    if (!hasQualityIntent) {
      return null;
    }

    const dataframe = dataContext.activeDataframe ?? dataContext.dataframes[0];
    if (!dataframe) {
      return null;
    }

    const columns = dataContext.columnsByDataframe[dataframe] ?? [];
    const allColumnNames = columns.map((c) => c.name);
    if (allColumnNames.length === 0) {
      return null;
    }

    const groupColumn = this.findBestGroupColumn(userInput, columns);
    const missingFocusColumn =
      columns.find((c) => /(contract|value|amount|cost|price|score|quantity)/i.test(c.name))?.name
      ?? columns.find((c) => this.mapColumnType(c.type) === 'numeric')?.name
      ?? allColumnNames[0];

    const assumptions = [
      'Effectiveness is approximated by data quality (completeness and consistency signals).',
      'Missing entries are represented as NA/null values.',
      groupColumn
        ? `Grouping entity is "${groupColumn}" based on available columns.`
        : 'A user/group column is not explicit; workflow defaults to row-level quality scoring until clarified.',
    ];

    const clarificationQuestions = groupColumn
      ? []
      : [
          'Which column identifies the user/entity to score (for example user_id, owner, contributor, or w_name)?',
        ];

    const selectedColumns = allColumnNames.slice(0, 20);
    const steps: AIPlanStep[] = [
      {
        stepId: 'quality-summary',
        operationId: 'describe.comparison.numeric_by_group',
        dialogId: 'summary',
        state: {
          dataframe,
          selectedColumns,
          groupByColumn: groupColumn ?? '',
          summaryMode: 'default',
          omitMissing: true,
        },
        inferredFields: groupColumn ? [] : ['groupByColumn'],
        confidence: groupColumn ? 0.9 : 0.72,
        rationale: 'Start with grouped summary to inspect completeness and anomalies across fields.',
      },
      {
        stepId: 'missing-records',
        operationId: 'data.filter',
        dialogId: 'filter',
        dependsOnStepId: 'quality-summary',
        state: {
          dataframe,
          conditions: [{ column: missingFocusColumn, operator: 'is.na', value: '' }],
          combineLogic: '&',
        },
        inferredFields: ['conditions'],
        confidence: 0.86,
        rationale: 'Isolate records with missing values in a key field for focused review.',
      },
      {
        stepId: 'quality-score',
        operationId: 'data.calculate',
        dialogId: 'calculate',
        dependsOnStepId: 'missing-records',
        state: {
          dataframe,
          newColumnName: 'quality_score',
          calcType: 'formula',
          formula: 'rowSums(!is.na(across(everything()))) / ncol(cur_data())',
        },
        inferredFields: ['formula'],
        confidence: 0.84,
        rationale: 'Create a normalized row-level completeness score between 0 and 1.',
      },
      {
        stepId: 'rank-quality',
        operationId: 'data.sort',
        dialogId: 'sort',
        dependsOnStepId: 'quality-score',
        state: {
          dataframe,
          sortColumns: [{ column: 'quality_score', descending: true }],
        },
        inferredFields: [],
        confidence: 0.9,
        rationale: 'Rank rows/entities by quality score to identify strongest and weakest quality outcomes.',
      },
    ];

    return {
      goal: `Assess data quality${groupColumn ? ` by ${groupColumn}` : ''} and rank effectiveness using a completeness score`,
      assumptions,
      clarificationQuestions,
      overallConfidence: groupColumn ? 0.88 : 0.74,
      requiresConfirmation: clarificationQuestions.length > 0,
      executionMode: 'component_codegen',
      modeReason: 'Deterministic quality recipe matched request intent.',
      modeConfidence: 0.9,
      steps,
    };
  }

  private findBestGroupColumn(
    userInput: string,
    columns: Array<{ name: string; type: string }>
  ): string | null {
    const lower = userInput.toLowerCase();
    const normalizedColumns = columns.map((c) => ({ ...c, lowerName: c.name.toLowerCase() }));

    // If prompt explicitly references a column name, prefer it.
    const exactMention = normalizedColumns.find((c) => lower.includes(c.lowerName));
    if (exactMention) {
      return exactMention.name;
    }

    // Explicit "by/per/each X" hint.
    const byMatch = lower.match(/\b(?:by|per|each)\s+([a-z0-9_]+)/i);
    if (byMatch?.[1]) {
      const token = byMatch[1].toLowerCase();
      const matched = normalizedColumns.find((c) => c.lowerName === token || c.lowerName.includes(token));
      if (matched) {
        return matched.name;
      }
    }

    // Common identifiers for person/entity/group.
    const ranked = normalizedColumns
      .map((c) => {
        const typeScore = this.mapColumnType(c.type) === 'factor' ? 2 : 0;
        let nameScore = 0;
        if (/(user|username|user_id|owner|contributor|author|created_by|w_name|name|entity|group)/i.test(c.name)) {
          nameScore = 4;
        } else if (/(id|code)/i.test(c.name)) {
          nameScore = 2;
        }
        return { name: c.name, score: typeScore + nameScore };
      })
      .sort((a, b) => b.score - a.score);

    return ranked[0] && ranked[0].score > 0 ? ranked[0].name : null;
  }

  private mapColumnType(rawType: string): 'numeric' | 'factor' | 'date' | 'any' {
    const t = rawType.toLowerCase();
    if (['numeric', 'integer', 'double'].some((x) => t.includes(x))) return 'numeric';
    if (['factor', 'character'].some((x) => t.includes(x))) return 'factor';
    if (['date', 'posix'].some((x) => t.includes(x))) return 'date';
    return 'any';
  }

  private extractJson(content: string): string {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }

    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return trimmed.slice(first, last + 1);
    }
    return trimmed;
  }
}
