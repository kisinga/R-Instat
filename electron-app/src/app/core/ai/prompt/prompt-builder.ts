/**
 * Composable prompt builder for the LLM planner.
 * Pure functions — no DI, fully testable.
 */

import type { DataContext, ExecutionMode } from '../types/data-context.types';
import type { PromptCategory } from '../pipeline-types';
import type { DialogueAIContext } from '../current-dialogue-contract';
import { mapColumnType } from '../shared/column-type-mapper';
import { getSchema } from '../dialog-catalog-aggregator';

export interface PromptBuilderInput {
  userInput: string;
  dataContext: DataContext;
  operationsJson: string;
  contractsJson: string;
  mode: ExecutionMode;
  scopedDialogIds: string[];
  currentDialogContext?: DialogueAIContext | null;
  category?: PromptCategory;
  pastInteractions?: Array<{ query: string; dialogId: string; state: Record<string, unknown> }>;
}

export function buildUserMessage(input: PromptBuilderInput): string {
  const inferenceHints = buildDataInferenceHints(input.dataContext);
  const paramReference = buildDialogParamReference(input.scopedDialogIds);
  const currentStateBlock =
    input.currentDialogContext != null
      ? `\nCurrent dialog state (use this to refine, not invent):\n${JSON.stringify(input.currentDialogContext)}\n\n`
      : '';
  const categoryBlock =
    input.category != null && input.category !== 'unclear'
      ? `\nCurrent intent category: ${input.category}. Do not offer clarifications that switch category. Any clarificationQuestions must stay within this category and each item must be a short intent statement (what the user is choosing), not a question—that text is sent as the next message.\n\n`
      : '';
  const memoryBlock =
    input.pastInteractions && input.pastInteractions.length > 0
      ? `\nSimilar past interactions (for reference, not binding):\n${input.pastInteractions.map((p, i) => `${i + 1}. "${p.query}" -> dialogId: "${p.dialogId}", state: ${JSON.stringify(p.state)}`).join('\n')}\n\n`
      : '';
  return `Data context:
- dataframes: ${JSON.stringify(input.dataContext.dataframes)}
- activeDataframe: ${input.dataContext.activeDataframe ?? 'null'}
- columnsByDataframe: ${JSON.stringify(input.dataContext.columnsByDataframe)}
- inferenceHints: ${inferenceHints}

Operation registry: ${input.operationsJson}
Dialog contracts: ${input.contractsJson}

Dialog param names reference (use ONLY these keys in state for each dialogId; no other keys allowed):
${paramReference}
${currentStateBlock}${categoryBlock}${memoryBlock}User request: ${input.userInput}
Target execution mode: ${input.mode}

Privacy note:
- Dataframe and column identifiers are aliased tokens (for example df_1, df_1_col_2).
- Use only identifiers visible in this prompt.

Return the strict JSON plan only.`;
}

export function buildDialogParamReference(dialogIds: string[]): string {
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

export function buildDataInferenceHints(dataContext: DataContext): string {
  const hints = Object.entries(dataContext.columnsByDataframe).map(([df, columns]) => {
    const byType = {
      numeric: columns
        .filter((c) => mapColumnType(c.type) === 'numeric')
        .map((c) => c.name)
        .slice(0, 8),
      factor: columns
        .filter((c) => mapColumnType(c.type) === 'factor')
        .map((c) => c.name)
        .slice(0, 8),
      date: columns
        .filter((c) => mapColumnType(c.type) === 'date')
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

export function buildDirectRPrompt(userInput: string, dataContext: DataContext): string {
  return `Rules: do not use file/network/system commands. Use existing dataframes/columns only.
Data context: ${JSON.stringify(dataContext)}
Request: ${userInput}`;
}
