/**
 * AI Client Service
 *
 * Calls selectable AI providers with strict multi-step plan output.
 */

import { Injectable, inject } from '@angular/core';
import { AIConfigService } from './ai-config.service';
import { OPERATION_REGISTRY } from '../ai/operation-registry';
import { buildCapabilityInventory, TEMPLATE_CODEGEN_DIALOG_IDS } from '../ai/capability-inventory';
import { getDialogContractsForPrompt } from '../ai/dialog-identity.registry';
import { DialogContractV2Registry } from '../ai/dialog-contract-v2.registry';
import { retrieveDialogContractsTopK } from '../ai/dialog-context-retriever';
import {
  aliasDataContext,
  applyAliasesToInput,
  buildPrivacyReport,
  deAliasPlan,
  deAliasScript,
  redactUserInput,
} from '../ai/pii-guard';

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

@Injectable({ providedIn: 'root' })
export class AIClientService {
  private readonly aiConfig = inject(AIConfigService);

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
- Respect parameter types/required/conditions from schemas.
- Set dependsOnStepId when a step requires output/preparation from a previous step.
- If uncertain, set requiresConfirmation=true and add clarificationQuestions.
- Multi-step plans are allowed when prerequisite transformation is needed.
- For data quality/effectiveness requests, prefer a composed workflow: summary by group, missing-record filter, calculate quality score, then sort/rank.
- Keep steps minimal and executable.`;

  async call(userInput: string, dataContext: DataContext): Promise<AICallResult> {
    const { context: aliasedContext, maps } = aliasDataContext(dataContext);
    const redacted = redactUserInput(userInput);
    const aliasedInput = applyAliasesToInput(redacted.value, maps);
    const privacyReport = buildPrivacyReport(redacted.patterns, maps);

    const modeDecision = this.routeExecutionMode(userInput);

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

    const retrievalSelection = this.selectContractsForPrompt(aliasedInput, aliasedContext);
    const contractsJson = JSON.stringify(retrievalSelection.contracts);
    const operationsJson = JSON.stringify(OPERATION_REGISTRY);

    const userMessage = this.buildUserMessage(
      aliasedInput,
      aliasedContext,
      operationsJson,
      contractsJson,
      modeDecision.mode
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
          retrievalReport: retrievalSelection.report,
          privacyReport,
        };
      }

      const content = provider === 'claude'
        ? await this.callClaude(apiKey, userMessage)
        : await this.callOpenAI(apiKey, userMessage);

      const parsed = this.parseDialogPlanContent(content, userInput, modeDecision);
      if (!parsed.success || !parsed.plan) {
        return { ...parsed, privacyReport };
      }

      const normalizedPlan = deAliasPlan(parsed.plan, maps);

      if (modeDecision.mode === 'structured_codegen') {
        const structuredPlan = this.buildStructuredCodePlan(normalizedPlan, modeDecision);
        return {
          success: true,
          plan: structuredPlan,
          retrievalReport: retrievalSelection.report,
          privacyReport,
        };
      }

      return { ...parsed, plan: normalizedPlan, retrievalReport: retrievalSelection.report, privacyReport };
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
    mode: ExecutionMode
  ): string {
    const inferenceHints = this.buildDataInferenceHints(dataContext);
    return `Data context:
- dataframes: ${JSON.stringify(dataContext.dataframes)}
- activeDataframe: ${dataContext.activeDataframe ?? 'null'}
- columnsByDataframe: ${JSON.stringify(dataContext.columnsByDataframe)}
- inferenceHints: ${inferenceHints}

Operation registry: ${operationsJson}
Dialog contracts: ${contractsJson}

User request: ${userInput}
Target execution mode: ${mode}

Privacy note:
- Dataframe and column identifiers are aliased tokens (for example df_1, df_1_col_2).
- Use only identifiers visible in this prompt.

Return the strict JSON plan only.`;
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
    modeDecision: ModeDecision
  ): AICallResult {
    try {
      const jsonContent = this.extractJson(content);
      const parsed = JSON.parse(jsonContent) as Partial<AIPlan>;
      if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
        return { success: false, error: 'Invalid response: missing plan steps', rawResponse: content };
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
          steps: parsed.steps as AIDialogPlanStep[],
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

  private routeExecutionMode(userInput: string): ModeDecision {
    const lower = userInput.toLowerCase();
    const directSignals = ['r code', 'r-code', 'write code', 'script', 'custom model', 'glm', 'survival'];
    if (directSignals.some((s) => lower.includes(s))) {
      return {
        mode: 'direct_r',
        reason: 'User requested script-level or advanced model behavior.',
        confidence: 0.9,
      };
    }

    const structuredSignals = ['merge', 'join', 'stack', 'unstack', 'line plot', 'dot plot'];
    if (structuredSignals.some((s) => lower.includes(s))) {
      return {
        mode: 'structured_codegen',
        reason: 'Intent includes operations not fully covered by dialog schema but suitable for templates.',
        confidence: 0.78,
      };
    }

    const inventory = buildCapabilityInventory();
    const coverage = inventory.summary.coveredDialog / Math.max(1, inventory.summary.totalHostDialogs);
    if (coverage >= 0.5) {
      return {
        mode: 'component_codegen',
        reason: 'Dialog schema coverage and strict validation are preferred for accuracy.',
        confidence: 0.82,
      };
    }

    return {
      mode: 'structured_codegen',
      reason: 'Schema coverage is partial; use typed code templates for better completeness.',
      confidence: 0.7,
    };
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
    if (!TEMPLATE_CODEGEN_DIALOG_IDS.has(step.dialogId)) {
      return null;
    }
    const state = step.state ?? {};
    switch (step.dialogId) {
      case 'sort': {
        const dataframe = String(state['dataframe'] ?? '');
        const cols = Array.isArray(state['sortColumns']) ? state['sortColumns'] as Array<Record<string, unknown>> : [];
        const args = cols
          .map((c) => (c['descending'] ? `dplyr::desc(${String(c['column'])})` : String(c['column'])))
          .filter(Boolean)
          .join(', ');
        return `${dataframe} <- ${dataframe} |> dplyr::arrange(${args})`;
      }
      case 'rename': {
        const dataframe = String(state['dataframe'] ?? '');
        return `${dataframe} <- ${dataframe} |> dplyr::rename(${String(state['newName'])} = ${String(state['oldName'])})`;
      }
      case 'calculate': {
        const dataframe = String(state['dataframe'] ?? '');
        const newCol = String(state['newColumnName'] ?? 'new_col');
        const formula = String(state['formula'] ?? 'NA');
        return `${dataframe} <- ${dataframe} |> dplyr::mutate(${newCol} = ${formula})`;
      }
      case 'correlation': {
        const dataframe = String(state['dataframe'] ?? '');
        const vars = Array.isArray(state['selectedVars']) ? (state['selectedVars'] as string[]) : [];
        const method = String(state['method'] ?? 'pearson');
        return `cor(${dataframe} |> dplyr::select(${vars.join(', ')}), use = "pairwise.complete.obs", method = "${method}")`;
      }
      case 'regression': {
        const dataframe = String(state['dataframe'] ?? '');
        const y = String(state['responseVar'] ?? '');
        const xs = Array.isArray(state['predictorVars']) ? (state['predictorVars'] as string[]) : [];
        return `stats::lm(${y} ~ ${xs.join(' + ')}, data = ${dataframe})`;
      }
      case 't-test': {
        const dataframe = String(state['dataframe'] ?? '');
        const testType = String(state['testType'] ?? 'one');
        if (testType === 'two') {
          return `stats::t.test(${String(state['variable1'])} ~ ${String(state['groupVar'])}, data = ${dataframe})`;
        }
        if (testType === 'paired') {
          return `stats::t.test(${dataframe}$${String(state['variable1'])}, ${dataframe}$${String(state['variable2'])}, paired = TRUE)`;
        }
        return `stats::t.test(${dataframe}$${String(state['variable1'])}, mu = ${String(state['mu'] ?? 0)})`;
      }
      case 'histogram': {
        const dataframe = String(state['dataframe'] ?? '');
        const x = String(state['variable'] ?? '');
        return `ggplot2::ggplot(${dataframe}, ggplot2::aes(x = ${x})) + ggplot2::geom_histogram()`;
      }
      case 'boxplot': {
        const dataframe = String(state['dataframe'] ?? '');
        return `ggplot2::ggplot(${dataframe}, ggplot2::aes(x = ${String(state['xVariable'] ?? '1')}, y = ${String(state['yVariable'] ?? '')})) + ggplot2::geom_boxplot()`;
      }
      case 'scatter': {
        const dataframe = String(state['dataframe'] ?? '');
        return `ggplot2::ggplot(${dataframe}, ggplot2::aes(x = ${String(state['xVariable'] ?? '')}, y = ${String(state['yVariable'] ?? '')})) + ggplot2::geom_point()`;
      }
      case 'bar-chart': {
        const dataframe = String(state['dataframe'] ?? '');
        return `ggplot2::ggplot(${dataframe}, ggplot2::aes(x = ${String(state['xVariable'] ?? '')})) + ggplot2::geom_bar()`;
      }
      default:
        return null;
    }
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

  private selectContractsForPrompt(userInput: string, dataContext: DataContext): {
    contracts: ReturnType<typeof getDialogContractsForPrompt>;
    report: AICallResult['retrievalReport'];
  } {
    const settings = this.aiConfig.retrievalSettings();
    const legacyContracts = getDialogContractsForPrompt();
    if (!settings.useDialogContractRetrieval || !this.isPlottingIntent(userInput)) {
      return {
        contracts: legacyContracts,
        report: {
          enabled: false,
          topK: settings.topKContracts,
          selectedDialogIds: legacyContracts.map((x) => x.dialogId),
          explainability: [],
        },
      };
    }

    const candidates = retrieveDialogContractsTopK(
      userInput,
      DialogContractV2Registry.getPromptContracts(),
      dataContext,
      settings.topKContracts
    );
    const selectedIds = new Set(candidates.map((x) => x.dialogId));
    const selectedContracts = legacyContracts.filter((contract) => selectedIds.has(contract.dialogId));

    return {
      contracts: selectedContracts.length > 0 ? selectedContracts : legacyContracts,
      report: {
        enabled: true,
        topK: settings.topKContracts,
        selectedDialogIds: selectedContracts.map((x) => x.dialogId),
        explainability: candidates.map((x) => ({
          dialogId: x.dialogId,
          score: x.score,
          reasons: x.reasons,
        })),
      },
    };
  }

  private isPlottingIntent(input: string): boolean {
    const lower = input.toLowerCase();
    const tokens = ['plot', 'graph', 'chart', 'histogram', 'bar chart', 'distribution', 'scatter', 'boxplot'];
    return tokens.some((token) => lower.includes(token));
  }
}
