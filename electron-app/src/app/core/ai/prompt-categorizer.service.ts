/**
 * Layer 1 – Categorizer: Compose rule-based strategy first, then LLM when rules do not match.
 * Classify user prompt into category and optional family.
 */

import { Injectable, inject } from '@angular/core';
import type { DialogFamily } from './dialog-contract-v2';
import type { CategorizerResult, PromptCategory } from './pipeline-types';
import { ruleBasedCategorizer } from './categorizer-rules';
import { AIConfigService } from '../services/ai-config.service';

const VALID_CATEGORIES: PromptCategory[] = [
  'open_dialog',
  'refine_current_dialog',
  'run_code',
  'education_question',
  'data_quality_recipe',
  'unclear',
];

const VALID_FAMILIES: DialogFamily[] = [
  'plotting',
  'data-preparation',
  'inferential',
  'predictive',
  'climatic',
  'other',
];

const CLASSIFICATION_SYSTEM = `You are a classifier for an R-based statistics app. Given the user's message and whether a dialog is currently open, respond with JSON only in this exact shape (no markdown, no explanation):
{"category": "<category>", "family": "<family or omit>"}

Categories (choose exactly one). Use unclear only when the intent is genuinely ambiguous (e.g. very short, vague, or could mean several different things). When in doubt, prefer a concrete category from context:
- open_dialog: User wants to open or use a dialog/feature (e.g. create a plot, run a t-test, filter data, import). Prefer this over run_code when the user mentions a named analysis, plot type, or app feature (e.g. "bar chart", "t-test", "regression", "filter") even if they say "code" in passing.
- refine_current_dialog: User wants to change or extend the currently open dialog (e.g. add a facet, use a different column). Only choose when a dialog is open AND the message clearly refers to modifying it (e.g. "use a different column", "add a facet", "do that", "change the x axis"). If a dialog is open and the message is vague but could mean refining it, prefer refine_current_dialog over unclear.
- run_code: Choose only when the user explicitly asks for raw R code, a script, or custom/model code (e.g. "write R code", "give me a script", "glm", "custom model", "run this code"). If they mention a named analysis or plot without asking for script/code, use open_dialog.
- education_question: User is asking for explanation, concept, or learning (e.g. "what is a t-test?", "explain regression", "what does X tell us?", "how does Y work?", "explain what a t-test tells us in the context of statistical analysis"). No execution; answer is informational. Prefer this when the user asks for explanation or understanding even if they mention a procedure name (e.g. t-test, regression).
- data_quality_recipe: User wants a data quality, missing-data, or effectiveness workflow/recipe.
- unclear: Only when none of the above fits and the intent cannot be inferred (e.g. empty, single word, or genuinely ambiguous). Do not use unclear when context disambiguates (e.g. "do that" with a dialog open → refine_current_dialog).

Family (include only when category is open_dialog): one of plotting, data-preparation, inferential, predictive, climatic, other. Omit for non-open_dialog.`;

@Injectable({ providedIn: 'root' })
export class PromptCategorizerService {
  private readonly aiConfig = inject(AIConfigService);

  /**
   * Categorize: try rule-based strategy first; if no match, call LLM.
   */
  async categorize(userInput: string, hasCurrentDialog: boolean): Promise<CategorizerResult> {
    const trimmed = userInput.trim();
    if (!trimmed) {
      return { category: 'unclear' };
    }

    const ruleResult = ruleBasedCategorizer(trimmed, hasCurrentDialog);
    if (ruleResult !== null) {
      return ruleResult;
    }

    const apiKey = this.aiConfig.apiKey();
    const provider = this.aiConfig.provider();
    if (!apiKey?.trim()) {
      return { category: 'unclear' };
    }

    const userMessage = `User message:\n${trimmed}\n\nDialog currently open: ${hasCurrentDialog}`;

    try {
      const raw =
        provider === 'claude'
          ? await this.callClaude(apiKey, CLASSIFICATION_SYSTEM, userMessage)
          : await this.callOpenAI(apiKey, CLASSIFICATION_SYSTEM, userMessage);

      const json = this.extractJson(raw);
      const parsed = JSON.parse(json) as { category?: string; family?: string };
      const category = this.normalizeCategory(parsed?.category);
      const family = this.normalizeFamily(parsed?.family, category);

      return { category, ...(family !== undefined && { family }) };
    } catch {
      return { category: 'unclear' };
    }
  }

  private normalizeCategory(value: unknown): PromptCategory {
    const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return VALID_CATEGORIES.includes(s as PromptCategory) ? (s as PromptCategory) : 'unclear';
  }

  private normalizeFamily(value: unknown, category: PromptCategory): DialogFamily | undefined {
    if (category !== 'open_dialog') return undefined;
    const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return VALID_FAMILIES.includes(s as DialogFamily) ? (s as DialogFamily) : undefined;
  }

  private extractJson(content: string): string {
    const trimmed = content.trim();
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
    return trimmed;
  }

  private async callClaude(apiKey: string, system: string, userMessage: string): Promise<string> {
    if (!window.electronAPI?.ai?.anthropicMessage) {
      throw new Error('Claude IPC unavailable');
    }
    const response = await window.electronAPI.ai.anthropicMessage({
      apiKey,
      system,
      userMessage,
      model: 'claude-haiku-4-5',
      maxTokens: 120,
      temperature: 0.1,
    });
    if (!response.ok) throw new Error(`Claude error: ${response.status}`);
    const data = response.data as { content?: Array<{ type?: string; text?: string }> };
    const text = (data?.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
    if (!text) throw new Error('Empty Claude response');
    return text;
  }

  private async callOpenAI(apiKey: string, system: string, userMessage: string): Promise<string> {
    if (!window.electronAPI?.ai?.openaiChat) {
      throw new Error('OpenAI IPC unavailable');
    }
    const response = await window.electronAPI.ai.openaiChat({
      apiKey,
      system,
      userMessage,
      model: 'gpt-4o-mini',
      temperature: 0.1,
      responseFormat: 'json_object',
    });
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = response.data as { choices?: Array<{ message?: { content?: string } }> };
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty OpenAI response');
    return text;
  }
}
