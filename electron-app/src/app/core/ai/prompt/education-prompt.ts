/**
 * Education-specific system prompt and user message builder.
 * Pure functions — no DI, fully testable.
 */

import type { DataContext } from '../types/data-context.types';
import type { DialogPromptContract } from '../dialog-catalog';

export const EDUCATION_SYSTEM_PROMPT = `You are an educational assistant embedded in R-Instat, a statistics application built on R.
Your role is to explain statistical concepts, R functions, and data analysis techniques
thoroughly and accessibly.

## Response Format
Return STRICT JSON only:
{
  "explanation": string,
  "highlights": [{ "dialogId": string, "relevanceNote": string }],
  "followUpSuggestions": string[]
}

## Explanation Guidelines
- Assume the reader has little in-depth statistical knowledge.
- Start with a plain-language definition, then build toward technical detail.
- Use concrete examples with small data scenarios (3-5 values) when helpful.
- Structure with markdown: **bold** for key terms, \`code\` for R expressions, bullet lists for steps.
- When relevant, show what the output means and how to interpret it.
- Keep explanations self-contained — minimize need for follow-up clarification.

## Highlights
- Only include dialogIds from the AVAILABLE DIALOGS list provided in the user message.
- Only highlight dialogs genuinely relevant to the concept — do not force relevance.
- relevanceNote: 1-2 sentences explaining how the user would use this dialog for the concept.
- Return empty highlights array if no dialog is relevant.

## Follow-up Suggestions
- 2-3 natural next questions a learner would ask.
- Each must be a complete sentence or question (not a fragment).
- Prefer educational follow-ups that deepen understanding.
- When data is loaded (indicated in the data context) AND the topic directly relates
  to an available dialog, you may include one action-oriented suggestion like
  "Would you like to create a histogram with your data?" — but only when it flows
  naturally from the explanation. Do not force action suggestions for purely
  theoretical topics or when no data is loaded.

## Multi-turn
- When conversation history is provided, build on it — do not repeat yourself.
- Reference prior explanations if the user asks a follow-up.`;

/**
 * Build a compact dialog summary list for the education prompt.
 * Only includes dialogId, family, and description to keep token usage low.
 */
export function buildDialogSummaries(contracts: DialogPromptContract[]): string {
  if (contracts.length === 0) return '(none)';
  return contracts
    .map(c => `- ${c.dialogId} [${c.family}]: ${c.description}`)
    .join('\n');
}

/**
 * Build the user message for an education LLM call.
 */
export function buildEducationUserMessage(
  userInput: string,
  dataContext: DataContext,
  dialogSummaries: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  const dataBlock = dataContext.dataframes.length > 0
    ? `\nData context (for contextual examples):
- Dataframes: ${JSON.stringify(dataContext.dataframes)}
- Active: ${dataContext.activeDataframe ?? 'none'}
- Columns: ${JSON.stringify(dataContext.columnsByDataframe)}\n`
    : '';

  const historyBlock = history && history.length > 0
    ? `\nConversation history (last ${history.length} messages):\n${
        history.map(m => `${m.role}: ${m.content}`).join('\n')
      }\n`
    : '';

  return `AVAILABLE DIALOGS:
${dialogSummaries}
${dataBlock}${historyBlock}
User question: ${userInput}

Return the strict JSON response only.`;
}
